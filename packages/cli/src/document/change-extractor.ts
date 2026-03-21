import type {
  ChangesetsInput,
  EntityChangesetInput,
  EntitySchema,
  EntityUid,
  Fieldset,
  FieldsetNested,
  Filter,
  Filters,
  Includes,
  KnowledgeGraph,
  NamespaceEditable,
  QueryParams,
  TransactionInput,
} from "@binder/db";
import { includesWithUid, isEntityDelete } from "@binder/db";
import {
  fail,
  isEqual,
  isErr,
  ok,
  type Result,
  type ResultAsync,
} from "@binder/utils";
import { extractFieldValues } from "../utils/interpolate-fields.ts";
import { interpolateQueryParams } from "../utils/query.ts";
import { diffEntities, diffQueryResults } from "../diff";
import type { FileSystem } from "../lib/filesystem.ts";
import {
  modifiedSnapshots,
  namespaceFromSnapshotPath,
  resolveSnapshotPath,
  type SnapshotChangeMetadata,
  snapshotRootForNamespace,
} from "../lib/snapshot.ts";
import { type AppConfig, BINDER_DIR } from "../config.ts";
import type { MatchOptions } from "../utils/file.ts";
import type { Logger } from "../log.ts";
import type { RuntimeContextWithDb } from "../runtime.ts";
import {
  buildNavigationTree,
  CONFIG_NAVIGATION_ITEMS,
  findNavigationItemByPath,
  getNavigationFilePatterns,
  getPathPattern,
  type NavigationItem,
} from "./navigation.ts";
import { parseYamlList } from "./yaml.ts";
import {
  extract,
  type ExtractedFileData,
  type ExtractedProjection,
} from "./extraction.ts";
import { normalizeReferences, normalizeReferencesList } from "./reference.ts";
import { type Views } from "./view-entity.ts";

const isSingleValueFilter = (filter: Filter): filter is string | number =>
  typeof filter === "string" || typeof filter === "number";

const buildCreateChangeset = (
  where: Filters,
  pathFields: Fieldset,
  entity: FieldsetNested,
): ChangesetsInput => {
  const typeFilter = where.type;
  if (!typeFilter || !isSingleValueFilter(typeFilter)) return [];

  const filterFields: Fieldset = {};
  for (const [key, value] of Object.entries(where)) {
    if (isSingleValueFilter(value)) {
      filterFields[key] = value;
    }
  }

  return [
    { ...entity, ...filterFields, ...pathFields } as ChangesetsInput[number],
  ];
};

type SingleEntityLookup =
  | { status: "found"; kgEntity: Fieldset }
  | { status: "create"; changeset: ChangesetsInput };

// Searches for exactly one entity by pathFields. Returns the found entity, a
// create changeset when there are zero results and `where` is provided, or an
// error when the result count is not exactly one.
const lookupSingleEntity = async (
  kg: KnowledgeGraph,
  namespace: NamespaceEditable,
  schema: EntitySchema,
  pathFields: Fieldset,
  entity: FieldsetNested,
  includes: Includes | undefined,
  where: Filters | undefined,
): ResultAsync<SingleEntityLookup> => {
  const kgResult = await kg.search(
    {
      filters: pathFields as Record<string, string>,
      includes: includes ? includesWithUid(includes) : undefined,
    },
    namespace,
  );
  if (isErr(kgResult)) return kgResult;

  if (kgResult.data.items.length === 0 && where) {
    const normalizedResult = await normalizeReferences(
      entity ?? {},
      schema,
      kg,
    );
    if (isErr(normalizedResult)) return normalizedResult;
    return ok({
      status: "create",
      changeset: buildCreateChangeset(where, pathFields, normalizedResult.data),
    });
  }

  if (kgResult.data.items.length !== 1) {
    return fail(
      "invalid_record_count",
      "Path fields must resolve to exactly one record",
      { pathFields, recordCount: kgResult.data.items.length },
    );
  }

  return ok({ status: "found", kgEntity: kgResult.data.items[0]! });
};

const diffSingle = async (
  kg: KnowledgeGraph,
  schema: EntitySchema,
  namespace: NamespaceEditable,
  entity: FieldsetNested,
  pathFields: Fieldset,
  includes?: Includes,
  where?: Filters,
): ResultAsync<ChangesetsInput> => {
  const lookupResult = await lookupSingleEntity(
    kg,
    namespace,
    schema,
    pathFields,
    entity,
    includes,
    where,
  );
  if (isErr(lookupResult)) return lookupResult;
  if (lookupResult.data.status === "create")
    return ok(lookupResult.data.changeset);

  const normalizedResult = await normalizeReferences(entity, schema, kg);
  if (isErr(normalizedResult)) return normalizedResult;

  return ok(
    diffEntities(schema, normalizedResult.data, lookupResult.data.kgEntity),
  );
};

const diffQueryWithEntities = async (
  kg: KnowledgeGraph,
  schema: EntitySchema,
  namespace: NamespaceEditable,
  entities: FieldsetNested[],
  query: QueryParams,
  pathFields: Fieldset,
): ResultAsync<ChangesetsInput> => {
  const interpolatedQuery = interpolateQueryParams(schema, query, [pathFields]);
  if (isErr(interpolatedQuery)) return interpolatedQuery;

  const kgResult = await kg.search(interpolatedQuery.data, namespace);
  if (isErr(kgResult)) return kgResult;

  const normalizedResult = await normalizeReferencesList(entities, schema, kg);
  if (isErr(normalizedResult)) return normalizedResult;

  const diffResult = diffQueryResults(
    schema,
    normalizedResult.data,
    kgResult.data.items,
    interpolatedQuery.data,
  );

  const toDelete = diffResult.toRemove.map((uid) => ({
    $ref: uid,
    $delete: true as const,
  }));

  return ok([...diffResult.toCreate, ...diffResult.toUpdate, ...toDelete]);
};

const diffDocument = async (
  kg: KnowledgeGraph,
  schema: EntitySchema,
  namespace: NamespaceEditable,
  entity: FieldsetNested,
  projections: ExtractedProjection[],
  pathFields: Fieldset,
  includes?: Includes,
  where?: Filters,
): ResultAsync<ChangesetsInput> => {
  const lookupResult = await lookupSingleEntity(
    kg,
    namespace,
    schema,
    pathFields,
    entity,
    includes,
    where,
  );
  if (isErr(lookupResult)) return lookupResult;
  if (lookupResult.data.status === "create")
    return ok(lookupResult.data.changeset);

  const normalizedResult = await normalizeReferences(entity, schema, kg);
  if (isErr(normalizedResult)) return normalizedResult;

  const changesets: ChangesetsInput = diffEntities(
    schema,
    normalizedResult.data,
    lookupResult.data.kgEntity,
  );

  for (const projection of projections) {
    const projectionResult = await diffQueryWithEntities(
      kg,
      schema,
      namespace,
      projection.items,
      projection.query,
      pathFields,
    );
    if (isErr(projectionResult)) return projectionResult;
    changesets.push(...projectionResult.data);
  }

  return ok(changesets);
};

const diffExtracted = (
  kg: KnowledgeGraph,
  schema: EntitySchema,
  namespace: NamespaceEditable,
  data: ExtractedFileData,
  pathFields: Fieldset,
  includes?: Includes,
  where?: Filters,
): ResultAsync<ChangesetsInput> => {
  if (data.kind === "single") {
    return diffSingle(
      kg,
      schema,
      namespace,
      data.entity,
      pathFields,
      includes,
      where,
    );
  }

  if (data.kind === "list") {
    return diffQueryWithEntities(
      kg,
      schema,
      namespace,
      data.entities,
      data.query,
      pathFields,
    );
  }

  return diffDocument(
    kg,
    schema,
    namespace,
    data.entity,
    data.projections,
    pathFields,
    data.includes,
    where,
  );
};

// Do not write to the database here — extractFileChanges runs outside the
// file lock scope. DB writes cause "database is locked" errors under
// concurrent access (LSP + CLI, or parallel CLI processes).
export const extractFileChanges = async <N extends NamespaceEditable>(
  fs: FileSystem,
  kg: KnowledgeGraph,
  config: AppConfig,
  navigationItems: NavigationItem[],
  schema: EntitySchema,
  relativePath: string,
  namespace: N,
  views: Views,
  sourceContent?: string,
  entityUid?: EntityUid,
): ResultAsync<ChangesetsInput<N>> => {
  const navItem = findNavigationItemByPath(navigationItems, relativePath);
  if (!navItem) {
    return fail(
      "navigation_item_not_found",
      "Not found item in navigation config for the path",
      { path: relativePath },
    );
  }

  let pathFields: Fieldset;
  if (entityUid) {
    pathFields = { uid: entityUid };
  } else {
    const pathFieldsResult = extractFieldValues(
      getPathPattern(navItem),
      relativePath,
    );
    if (isErr(pathFieldsResult)) return pathFieldsResult;
    pathFields = pathFieldsResult.data;
  }

  const absolutePath = resolveSnapshotPath(relativePath, config.paths);

  const contentResult = sourceContent
    ? ok(sourceContent)
    : await fs.readFile(absolutePath);
  if (isErr(contentResult)) return contentResult;

  const includes =
    navItem.includes ?? views.find((t) => t.key === navItem.view)?.viewIncludes;

  const baseResult = await kg.search(
    {
      filters: pathFields as Record<string, string>,
      includes: includes ? includesWithUid(includes) : undefined,
    },
    namespace,
  );
  const isNewEntity = isErr(baseResult) || baseResult.data.items.length === 0;
  const base =
    !isErr(baseResult) && baseResult.data.items.length === 1
      ? baseResult.data.items[0]!
      : {};

  const extractResult = extract(
    schema,
    navItem,
    contentResult.data,
    absolutePath,
    views,
    base,
  );
  if (isErr(extractResult)) {
    // For new entities, extraction may fail (e.g. empty file doesn't match
    // the view structure). Fall back to creating from where + pathFields.
    if (isNewEntity && navItem.where) {
      return ok(buildCreateChangeset(navItem.where, pathFields, {}));
    }
    extractResult.error.data = {
      ...extractResult.error.data,
      file: relativePath,
    };
    return extractResult;
  }

  const changesets = await diffExtracted(
    kg,
    schema,
    namespace,
    extractResult.data,
    pathFields,
    includes,
    navItem.where,
  );
  if (isErr(changesets)) return changesets;

  return changesets;
};

const extractNamespaceChanges = async <N extends NamespaceEditable>(
  { fs, config, kg, nav }: RuntimeContextWithDb,
  modifiedFiles: SnapshotChangeMetadata[],
  namespace: N,
  views: Views,
): ResultAsync<ChangesetsInput<N>> => {
  const changesets: ChangesetsInput<N> = [];
  const navigationItemsResult = await nav(namespace);
  if (isErr(navigationItemsResult)) return navigationItemsResult;
  const schemaResult = await kg.getSchema(namespace);
  if (isErr(schemaResult)) return schemaResult;

  for (const file of modifiedFiles) {
    const entityUid =
      file.type !== "untracked" ? (file.entityUid ?? undefined) : undefined;
    const syncResult = await extractFileChanges(
      fs,
      kg,
      config,
      navigationItemsResult.data,
      schemaResult.data,
      file.path,
      namespace,
      views,
      undefined,
      entityUid,
    );
    if (isErr(syncResult)) return syncResult;

    changesets.push(...syncResult.data);
  }

  return ok(changesets);
};

const detectCrossFileConflicts = <N extends NamespaceEditable>(
  changesets: ChangesetsInput<N>,
): Result<void> => {
  const byRef = new Map<string, EntityChangesetInput<N>[]>();
  for (const cs of changesets) {
    const ref = "$ref" in cs ? (cs.$ref as string) : undefined;
    if (!ref) continue;
    const group = byRef.get(ref);
    if (group) group.push(cs);
    else byRef.set(ref, [cs]);
  }

  for (const [ref, group] of byRef) {
    if (group.length < 2) continue;

    const hasDelete = group.some(isEntityDelete);
    if (hasDelete) {
      return fail(
        "field-conflict",
        `Conflicting changes for entity '${ref}': deletion cannot be combined with other updates from different files`,
        {
          fieldPath: ["$delete"],
          values: group.map((cs) => ({ value: cs })),
          baseValue: null,
        },
      );
    }

    const fieldValues = new Map<string, unknown>();
    for (const cs of group) {
      for (const [key, value] of Object.entries(cs)) {
        if (key === "$ref" || key === "type" || key === "key") continue;
        const existing = fieldValues.get(key);
        if (existing === undefined) {
          fieldValues.set(key, value);
        } else if (!isEqual(existing, value)) {
          return fail(
            "field-conflict",
            `Conflicting values for field '${key}' on entity '${ref}' from different files`,
            {
              fieldPath: [key],
              values: [{ value: existing }, { value }],
              baseValue: null,
            },
          );
        }
      }
    }
  }

  return ok(undefined);
};

export const extractModifiedFileChanges = async (
  runtime: RuntimeContextWithDb,
  scopePath?: string,
  log?: Logger,
): ResultAsync<TransactionInput | null> => {
  const { config, db, kg, fs } = runtime;
  const scopeAbsolute = scopePath
    ? resolveSnapshotPath(scopePath, config.paths)
    : null;
  const scopeNamespace = scopeAbsolute
    ? namespaceFromSnapshotPath(scopeAbsolute, config.paths)
    : null;

  const scanNamespace = (ns: NamespaceEditable, options?: MatchOptions) => {
    if (scopeNamespace && scopeNamespace !== ns) return ok([]);
    const path = scopeAbsolute ?? snapshotRootForNamespace(ns, config.paths);
    return modifiedSnapshots(db, fs, config.paths, path, options);
  };

  const configIncludePatterns = getNavigationFilePatterns(
    CONFIG_NAVIGATION_ITEMS,
  );

  const configResult = await scanNamespace("config", {
    include: configIncludePatterns,
  });
  if (isErr(configResult)) return configResult;
  const configFiles = configResult.data;

  // When the navigation file is modified, read it from disk and build a fresh
  // navigation tree so record scanning uses the updated paths.
  const navFilePath = `${BINDER_DIR}/navigation.yaml`;
  const hasNavChange = configFiles.some((f) => f.path === navFilePath);

  let recordNavigation: NavigationItem[];
  if (hasNavChange) {
    const absNavPath = resolveSnapshotPath(navFilePath, config.paths);
    const navContentResult = await fs.readFile(absNavPath);
    if (isErr(navContentResult)) return navContentResult;
    const navEntitiesResult = parseYamlList(navContentResult.data);
    if (isErr(navEntitiesResult)) return navEntitiesResult;
    recordNavigation = buildNavigationTree(navEntitiesResult.data);
  } else {
    const nodeNavigationResult = await runtime.nav("record");
    if (isErr(nodeNavigationResult)) return nodeNavigationResult;
    recordNavigation = nodeNavigationResult.data;
  }

  const nodeIncludePatterns = [
    ...getNavigationFilePatterns(recordNavigation),
    ...(config.include ?? []),
  ];

  const nodeResult = await scanNamespace("record", {
    include: nodeIncludePatterns,
    exclude: config.exclude,
  });
  if (isErr(nodeResult)) return nodeResult;
  const nodeFiles = nodeResult.data;

  log?.debug("Modified files detected", {
    configFiles: configFiles.map((f) => ({ path: f.path, type: f.type })),
    nodeFiles: nodeFiles.map((f) => ({ path: f.path, type: f.type })),
  });

  if (configFiles.length === 0 && nodeFiles.length === 0) return ok(null);

  const viewsResult = await runtime.views();
  if (isErr(viewsResult)) return viewsResult;
  const views = viewsResult.data;

  const recordRuntime = hasNavChange
    ? {
        ...runtime,
        nav: ((ns?: NamespaceEditable) =>
          ns === "config"
            ? runtime.nav("config")
            : ok(recordNavigation)) as typeof runtime.nav,
      }
    : runtime;

  const [configsResult, recordsResult] = await Promise.all([
    extractNamespaceChanges(runtime, configFiles, "config", views),
    extractNamespaceChanges(recordRuntime, nodeFiles, "record", views),
  ]);

  if (isErr(configsResult)) return configsResult;
  if (isErr(recordsResult)) return recordsResult;

  const configs = configsResult.data;
  const records = recordsResult.data;

  log?.debug("Changesets after extraction", {
    configChangesets: configs.length,
    nodeChangesets: records.length,
    nodeDetails: records.map((n) => {
      const { $ref, type, key, ...fields } = n as Record<string, unknown>;
      return {
        ref: $ref ?? key ?? type,
        fields: Object.keys(fields),
      };
    }),
  });

  if (configs.length === 0 && records.length === 0) return ok(null);

  const nodeConflicts = detectCrossFileConflicts(records);
  if (isErr(nodeConflicts)) return nodeConflicts;
  const configConflicts = detectCrossFileConflicts(configs);
  if (isErr(configConflicts)) return configConflicts;

  return ok({
    author: config.author,
    records,
    configs,
  });
};
