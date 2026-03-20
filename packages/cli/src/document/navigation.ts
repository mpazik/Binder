import { extname, join } from "path";
import {
  type AncestralFieldsetChain,
  buildIncludes,
  emptyFieldset,
  type EntitySchema,
  type EntityUid,
  type Fieldset,
  type FieldsetNested,
  type Filter,
  type Filters,
  type GraphVersion,
  type Includes,
  type KnowledgeGraph,
  matchesFilters,
  mergeIncludes,
  type NamespaceEditable,
  pickByIncludes,
  type QueryParams,
  stringifyFieldValue,
} from "@binder/db";
import {
  assertDefinedPass,
  isErr,
  ok,
  omit,
  type Result,
  type ResultAsync,
} from "@binder/utils";
import type { Logger } from "../log.ts";
import { sanitizeFilename } from "../utils/file.ts";
import {
  extractFieldValues,
  interpolateAncestralFields,
  interpolatePlain,
} from "../utils/interpolate-fields.ts";
import type { DatabaseCli } from "../db";
import { interpolateQueryParams } from "../utils/query.ts";
import { saveSnapshot } from "../lib/snapshot.ts";
import type { FileSystem } from "../lib/filesystem.ts";
import { BINDER_DIR, type ConfigPaths } from "../config.ts";
import { renderView } from "./view.ts";
import {
  findEntityInYamlList,
  renderYamlEntity,
  renderYamlList,
} from "./yaml.ts";
import { formatReferences, formatReferencesList } from "./reference.ts";
import type { FileType } from "./document.ts";
import {
  DOCUMENT_VIEW_KEY,
  VIEW_VIEW_KEY,
  type ViewEntity,
  type ViewKey,
  type Views,
} from "./view-entity.ts";
import { prependFrontmatter, renderFrontmatterString } from "./frontmatter.ts";

export type RenderResult = {
  renderedPaths: string[];
  modifiedPaths: string[];
};

const emptyRenderResult = (): RenderResult => ({
  renderedPaths: [],
  modifiedPaths: [],
});

const mergeRenderResults = (results: RenderResult[]): RenderResult => ({
  renderedPaths: results.flatMap((r) => r.renderedPaths),
  modifiedPaths: results.flatMap((r) => r.modifiedPaths),
});

const inferFileType = (item: NavigationItem): FileType => {
  if (item.path.endsWith("/")) return "directory";
  if (item.view !== undefined) return "markdown";
  return "yaml";
};

const getExtension = (fileType: FileType): string => {
  if (fileType === "markdown") return ".md";
  if (fileType === "yaml") return ".yaml";
  return "";
};

export const getPathPattern = (item: NavigationItem): string =>
  item.path + getExtension(inferFileType(item));

export type NavigationItem = {
  path: string;
  where?: Filters;
  view?: string;
  includes?: Includes;
  query?: QueryParams;
  limit?: number;
  children?: NavigationItem[];
};

const DEFAULT_RENDER_LIMIT = 1_000;

export type RenderContext = {
  db: DatabaseCli;
  kg: KnowledgeGraph;
  fs: FileSystem;
  paths: ConfigPaths;
  schema: EntitySchema;
  version: GraphVersion;
  namespace: NamespaceEditable;
  views: Views;
  log: Logger;
};

export const CONFIG_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    path: `${BINDER_DIR}/fields`,
    query: {
      filters: { type: "Field" },
    },
  },
  {
    path: `${BINDER_DIR}/types`,
    query: {
      filters: { type: "Type" },
    },
  },
  {
    path: `${BINDER_DIR}/navigation`,
    query: {
      filters: { type: "Navigation" },
    },
  },
  {
    path: `${BINDER_DIR}/views/{key}`,
    where: { type: "View" },
    view: VIEW_VIEW_KEY,
  },
];

export const getNavigationFilePatterns = (items: NavigationItem[]): string[] =>
  items.map((item) => {
    const pattern = getPathPattern(item);
    const result = interpolatePlain(pattern, () => ok("*"));
    return isErr(result) ? pattern : result.data;
  });

export const buildNavigationTree = (
  items: FieldsetNested[],
): NavigationItem[] => {
  const childrenByParentKey = new Map<string, FieldsetNested[]>();

  for (const item of items) {
    const parentKey = item.parent as string | undefined;
    if (parentKey) {
      const siblings = childrenByParentKey.get(parentKey) ?? [];
      siblings.push(item);
      childrenByParentKey.set(parentKey, siblings);
    }
  }

  const buildTree = (item: FieldsetNested): NavigationItem => {
    const childItems = childrenByParentKey.get(item.key as string);
    const children = childItems?.map((child) => buildTree(child));

    return {
      path: item.path as string,
      where: item.where as Filters | undefined,
      view: item.view as string | undefined,
      includes: item.includes as Includes | undefined,
      query: item.query as QueryParams | undefined,
      limit: item.limit as number | undefined,
      ...(children && children.length > 0 ? { children } : {}),
    };
  };

  return items.filter((item) => !item.parent).map((root) => buildTree(root));
};

export const loadNavigation = async (
  kg: KnowledgeGraph,
  namespace: NamespaceEditable = "record",
): ResultAsync<NavigationItem[]> => {
  if (namespace === "config") return ok(CONFIG_NAVIGATION_ITEMS);

  const searchResult = await kg.search(
    {
      filters: { type: "Navigation" },
    },
    "config",
  );

  if (isErr(searchResult)) return searchResult;

  return ok(buildNavigationTree(searchResult.data.items));
};

export const findNavigationItemByPath = (
  items: NavigationItem[],
  path: string,
): NavigationItem | undefined => {
  for (const item of items) {
    const fileType = inferFileType(item);

    if (fileType === "directory") {
      if (!item.children) continue;

      const slashCount = (item.path.match(/\//g) || []).length;
      let slashIndex = -1;
      for (let i = 0; i < slashCount; i++) {
        slashIndex = path.indexOf("/", slashIndex + 1);
        if (slashIndex === -1) break;
      }
      if (slashIndex === -1) continue;

      const pathPrefix = path.slice(0, slashIndex + 1);
      const pathFieldsResult = extractFieldValues(item.path, pathPrefix);
      if (isErr(pathFieldsResult)) continue;

      const remainingPath = path.slice(slashIndex + 1);
      const found = findNavigationItemByPath(item.children, remainingPath);
      if (found) return found;
    } else {
      const pathPattern = item.path + getExtension(fileType);
      const pathFieldsResult = extractFieldValues(pathPattern, path);
      if (isErr(pathFieldsResult)) continue;
      return item;
    }
  }
};

export const resolvePath = (
  schema: EntitySchema,
  navItem: NavigationItem,
  entity: Fieldset,
  parentEntities: AncestralFieldsetChain = [],
): Result<string> => {
  const fileType = inferFileType(navItem);
  const extension = getExtension(fileType);
  const pathPattern = navItem.path + extension;
  const context = [entity, ...parentEntities];

  return interpolateAncestralFields(schema, pathPattern, (fieldName, depth) =>
    sanitizeFilename(
      stringifyFieldValue(
        context[depth]?.[fieldName],
        schema.fields[fieldName],
      ),
    ),
  );
};

const getParentDir = (filePath: string, fileType: FileType): string => {
  if (fileType === "directory") return filePath;
  const ext = extname(filePath);
  const withoutExt = ext ? filePath.slice(0, -ext.length) : filePath;
  return withoutExt + "/";
};

const isSingleValueFilter = (filter: Filter): boolean =>
  typeof filter !== "object" || !filter;

const getExcludedFields = (
  namespace: NamespaceEditable,
  filters: Filters | undefined,
): readonly string[] => {
  const excluded: string[] = ["id"];
  if (namespace === "config") excluded.push("uid");

  // hide type, if only single type is being displayed
  if (filters?.type && isSingleValueFilter(filters.type)) excluded.push("type");
  return excluded;
};

export const findView = (views: Views, key: string | undefined): ViewEntity => {
  const found = views.find((t) => t.key === key);
  if (found) return found;
  const defaultView = views.find((t) => t.key === DOCUMENT_VIEW_KEY);
  return assertDefinedPass(
    defaultView,
    `DOCUMENT_VIEW_KEY "${DOCUMENT_VIEW_KEY}" in views`,
  );
};

const renderContent = async (
  kg: KnowledgeGraph,
  schema: EntitySchema,
  item: NavigationItem,
  entity: FieldsetNested,
  parentEntities: AncestralFieldsetChain,
  fileType: FileType,
  namespace: NamespaceEditable,
  views: Views,
): ResultAsync<string | null> => {
  if (fileType === "markdown") {
    const formattedEntity = await formatReferences(entity, schema, kg);
    if (isErr(formattedEntity)) return formattedEntity;

    const viewEntity = findView(views, item.view);
    const viewResult = renderView(
      schema,
      views,
      viewEntity.key as ViewKey,
      formattedEntity.data,
    );
    if (isErr(viewResult)) return viewResult;

    const preamble = viewEntity.preamble;
    if (!preamble || preamble.length === 0) return ok(viewResult.data);

    const preambleIncludes = buildIncludes(preamble.map((key) => [key]));
    if (!preambleIncludes) return ok(viewResult.data);

    const pickedEntity = pickByIncludes(formattedEntity.data, preambleIncludes);
    const frontmatter = renderFrontmatterString(pickedEntity, preamble, schema);
    if (!frontmatter) return ok(viewResult.data);

    return ok(prependFrontmatter(viewResult.data, frontmatter));
  }
  if (fileType === "yaml") {
    if (item.query) {
      const interpolatedQuery = interpolateQueryParams(schema, item.query, [
        entity,
        ...parentEntities,
      ]);
      if (isErr(interpolatedQuery)) return interpolatedQuery;

      const queryResult = await kg.search(interpolatedQuery.data, namespace);
      if (isErr(queryResult)) return queryResult;

      const formattedItems = await formatReferencesList(
        queryResult.data.items,
        schema,
        kg,
      );
      if (isErr(formattedItems)) return formattedItems;

      if (item.query.includes) {
        const items = item.query.includes.uid
          ? formattedItems.data
          : formattedItems.data.map((e) => omit(e, ["uid"]));
        return ok(renderYamlList(items, schema));
      }

      const excludedFields = getExcludedFields(namespace, item.query.filters);
      const filteredItems = formattedItems.data.map((e) =>
        omit(e, [...excludedFields, "uid"]),
      );
      return ok(renderYamlList(filteredItems, schema));
    }
    const formattedEntity = await formatReferences(entity, schema, kg);
    if (isErr(formattedEntity)) return formattedEntity;

    const excludedFields = getExcludedFields(namespace, item.where);
    const filteredEntity = omit(formattedEntity.data, excludedFields);
    return ok(renderYamlEntity(filteredEntity, schema));
  }
  return ok(null);
};

export const renderNavigationItem = async (
  ctx: RenderContext,
  item: NavigationItem,
  parentPath: string,
  parentEntities: Fieldset[],
): ResultAsync<RenderResult> => {
  const { db, kg, fs, paths, schema, version, namespace, views, log } = ctx;
  const fileType = inferFileType(item);
  const result = emptyRenderResult();

  let entities: FieldsetNested[];

  if (item.where) {
    const interpolatedQuery = interpolateQueryParams(
      schema,
      {
        filters: item.where,
        includes: item.includes,
        pagination: { limit: item.limit ?? DEFAULT_RENDER_LIMIT },
      },
      [emptyFieldset, ...parentEntities],
    );
    if (isErr(interpolatedQuery)) return interpolatedQuery;

    if (item.view) {
      const viewEntity = findView(views, item.view);
      interpolatedQuery.data.includes = mergeIncludes(
        mergeIncludes(interpolatedQuery.data.includes, viewEntity.viewIncludes),
        { key: true, uid: true },
      );
    } else if (interpolatedQuery.data.includes) {
      interpolatedQuery.data.includes = mergeIncludes(
        interpolatedQuery.data.includes,
        { uid: true },
      );
    }

    const searchResult = await kg.search(interpolatedQuery.data, namespace);
    if (isErr(searchResult)) return searchResult;

    if (searchResult.data.pagination.hasNext && !item.limit) {
      const pathPattern = getPathPattern(item);
      log.warn(
        `Navigation '${pathPattern}' has more results than the default render limit. Some files were not rendered. Set 'limit' on the navigation item to increase.`,
      );
    }

    entities = searchResult.data.items;
  } else {
    entities = [parentEntities[0] ?? emptyFieldset];
  }

  // Strip uid from rendered output when the user specified includes but
  // didn't list uid. Views control their own output so no stripping needed.
  // When includes is undefined (all fields), uid stays.
  const stripUid = !item.view && !!item.includes && !item.includes.uid;

  for (const entity of entities) {
    const entityUid = (entity.uid as EntityUid) ?? null;

    const resolvedPath = resolvePath(
      schema,
      item,
      entity as Fieldset,
      parentEntities,
    );
    if (isErr(resolvedPath)) return resolvedPath;
    const filePath = join(parentPath, resolvedPath.data);

    const renderEntity =
      stripUid && "uid" in entity
        ? (omit(entity, ["uid"]) as FieldsetNested)
        : entity;

    const renderContentResult = await renderContent(
      kg,
      schema,
      item,
      renderEntity,
      parentEntities,
      fileType,
      namespace,
      views,
    );
    if (isErr(renderContentResult)) return renderContentResult;

    if (renderContentResult.data !== null) {
      const saveResult = await saveSnapshot(
        db,
        fs,
        paths,
        filePath,
        renderContentResult.data,
        version,
        entityUid,
      );
      if (isErr(saveResult)) return saveResult;

      result.renderedPaths.push(filePath);
      if (saveResult.data) {
        result.modifiedPaths.push(filePath);
      }
    }

    if (item.children) {
      const itemDir = getParentDir(filePath, fileType);
      const childParentEntities = item.where
        ? [entity as Fieldset, ...parentEntities]
        : parentEntities;

      for (const child of item.children) {
        const childResult = await renderNavigationItem(
          ctx,
          child,
          itemDir,
          childParentEntities,
        );
        if (isErr(childResult)) return childResult;

        result.renderedPaths.push(...childResult.data.renderedPaths);
        result.modifiedPaths.push(...childResult.data.modifiedPaths);
      }
    }
  }

  return ok(result);
};

export const renderNavigation = async (
  ctx: Omit<RenderContext, "schema" | "version">,
  navigationItems: NavigationItem[],
): ResultAsync<RenderResult> => {
  const schemaResult = await ctx.kg.getSchema(ctx.namespace);
  if (isErr(schemaResult)) return schemaResult;

  const versionResult = await ctx.kg.version();
  if (isErr(versionResult)) return versionResult;

  const renderCtx: RenderContext = {
    ...ctx,
    schema: schemaResult.data,
    version: versionResult.data,
  };

  const results: RenderResult[] = [];

  for (const item of navigationItems) {
    const result = await renderNavigationItem(renderCtx, item, "", []);
    if (isErr(result)) return result;
    results.push(result.data);
  }

  return ok(mergeRenderResults(results));
};

export type LocationInFile = {
  filePath: string;
  line: number;
};

const isListNavItem = (item: NavigationItem): boolean =>
  item.query !== undefined;

const flattenNavigationItems = (items: NavigationItem[]): NavigationItem[] => {
  const result: NavigationItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children) result.push(...flattenNavigationItems(item.children));
  }
  return result;
};

const scoreNavItem = (item: NavigationItem): number => {
  let score = 0;

  // Individual file >> list - user wants the dedicated file, not a line in a list
  if (!isListNavItem(item)) score += 100;

  // Markdown > YAML - markdown is the richer, primary representation
  if (inferFileType(item) === "markdown") score += 50;

  // Tiebreaker: simpler paths and filters are preferred.
  // When scores are equal, we assume the user wants the "default" or "canonical"
  // location rather than a special-case or highly-specific organizational path.
  // e.g., "tasks/{key}.md" is preferred over "projects/{project}/tasks/{key}.md"
  const filters = item.where ?? item.query?.filters;
  const filterCount = filters ? Object.keys(filters).length : 0;
  const pathDepth = (item.path.match(/\{/g) || []).length;

  score -= filterCount;
  score -= pathDepth;

  return score;
};

const findMatchingNavItem = (
  items: NavigationItem[],
  entity: Fieldset,
): NavigationItem | undefined => {
  const flattened = flattenNavigationItems(items);

  const matches: { item: NavigationItem; score: number }[] = [];

  for (const item of flattened) {
    const filters = item.where ?? item.query?.filters;
    if (!filters) continue;
    if (!matchesFilters(filters, entity)) continue;

    matches.push({ item, score: scoreNavItem(item) });
  }

  if (matches.length === 0) return undefined;

  matches.sort((a, b) => b.score - a.score);
  return matches[0]!.item;
};

export const findEntityLocation = async (
  fs: FileSystem,
  paths: ConfigPaths,
  schema: EntitySchema,
  entity: Fieldset,
  navigation: NavigationItem[],
): ResultAsync<LocationInFile | undefined> => {
  const navItem = findMatchingNavItem(navigation, entity);
  if (!navItem) return ok(undefined);

  const resolvedPathResult = resolvePath(schema, navItem, entity, []);
  if (isErr(resolvedPathResult)) return resolvedPathResult;

  const filePath = join(paths.docs, resolvedPathResult.data);

  if (!isListNavItem(navItem)) {
    return ok({ filePath, line: 0 });
  }

  const contentResult = await fs.readFile(filePath);
  if (isErr(contentResult)) return ok({ filePath, line: 0 });

  const entityKey = entity.key as string | undefined;
  const entityUid = entity.uid as string | undefined;

  if (!entityKey && !entityUid) return ok({ filePath, line: 0 });

  const line = findEntityInYamlList(contentResult.data, entityKey, entityUid);
  return ok({ filePath, line });
};

export type NavigationLoader = (
  namespace?: NamespaceEditable,
) => ResultAsync<NavigationItem[]>;
export type NavigationCache = {
  load: NavigationLoader;
  invalidate: () => void;
};

export const createNavigationCache = (kg: KnowledgeGraph): NavigationCache => {
  const cache: Record<NamespaceEditable, NavigationItem[] | null> = {
    record: null,
    config: null,
  };

  return {
    load: async (namespace = "record") => {
      const cached = cache[namespace];
      if (cached) return ok(cached);

      const result = await loadNavigation(kg, namespace);
      if (isErr(result)) return result;

      cache[namespace] = result.data;
      return result;
    },
    invalidate: () => {
      // config navigation items are hardcoded
      cache.record = null;
    },
  };
};
