import type {
  ChangesetsInput,
  EntityChangesetInput,
  EntitySchema,
  EntityType,
  EntityUid,
  FieldKey,
  FieldNestedValue,
  Fieldset,
  FieldsetNested,
  FieldValue,
  ListMutation,
  RecordUid,
  QueryParams,
} from "@binder/db";
import {
  coreIdentityFieldKeys,
  createUid,
  extractUid,
  isFieldsetNested,
} from "@binder/db";
import { assert, assertDefined, includes, isEqual } from "@binder/utils";
import { extractFieldsetFromQuery } from "../utils/query.ts";
import { matchEntities, type MatcherConfig } from "./entity-matcher.ts";
import { classifyFields } from "./field-classifier.ts";

const getType = (node: Fieldset): EntityType | undefined =>
  typeof node.type === "string" ? (node.type as EntityType) : undefined;

const collectNonIdentityFields = (
  schema: EntitySchema,
  node: FieldsetNested,
): Record<string, unknown> => {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "id" || key === "uid" || key === "type") continue;
    const fieldDef = schema.fields[key as FieldKey];
    if (fieldDef?.dataType === "relation" && fieldDef.allowMultiple) continue;
    fields[key] = value;
  }
  return fields;
};

const buildEntityCreate = (
  schema: EntitySchema,
  node: FieldsetNested,
  generatedUid: RecordUid,
  range?: EntityType[],
): EntityChangesetInput<"record"> | null => {
  const type = getType(node) ?? (range?.length === 1 ? range[0] : undefined);
  if (!type) return null;

  return {
    type,
    uid: generatedUid,
    ...collectNonIdentityFields(schema, node),
  } as EntityChangesetInput<"record">;
};

const extractOwnedChildren = (value: FieldNestedValue): FieldsetNested[] => {
  if (value === null || !Array.isArray(value)) return [];
  return value.filter(isFieldsetNested);
};

const diffOwnedChildren = (
  schema: EntitySchema,
  newChildren: FieldsetNested[],
  oldChildren: FieldsetNested[],
  range?: EntityType[],
): { changesets: ChangesetsInput; mutations: ListMutation[] } => {
  const changesets: ChangesetsInput = [];
  const mutations: ListMutation[] = [];

  const classifications = classifyFields(schema);
  const config: MatcherConfig = { schema, classifications };

  const matchResult = matchEntities(config, newChildren, oldChildren);

  for (const newIdx of matchResult.toCreate) {
    const generatedUid = createUid() as RecordUid;
    const created = buildEntityCreate(
      schema,
      newChildren[newIdx]!,
      generatedUid,
      range,
    );
    if (created) changesets.push(created);
    mutations.push(["insert", generatedUid]);
  }

  for (const oldIdx of matchResult.toRemove) {
    const oldNode = oldChildren[oldIdx]!;
    const oldUid = extractUid(oldNode);
    assertDefined(oldUid, "oldUid in diffOwnedChildren toRemove");
    mutations.push(["remove", oldUid]);
  }

  for (const { newIndex, oldIndex } of matchResult.matches) {
    changesets.push(
      ...diffEntities(schema, newChildren[newIndex]!, oldChildren[oldIndex]!),
    );
  }

  return { changesets, mutations };
};

const diffSingleRelation = (
  schema: EntitySchema,
  newValue: FieldNestedValue,
  oldValue: FieldNestedValue,
): ChangesetsInput => {
  if (!isFieldsetNested(newValue) || !isFieldsetNested(oldValue)) return [];

  const oldUid = extractUid(oldValue);
  const newUid = extractUid(newValue);

  // When newUid is undefined but oldUid exists, we're editing the same related
  // entity (extracted from markdown doesn't include uid). Set uid from old.
  if (!oldUid) return [];
  if (newUid !== undefined && oldUid !== newUid) return [];

  const newWithUid = newUid ? newValue : { ...newValue, uid: oldUid };
  return diffEntities(schema, newWithUid, oldValue);
};

const isComplex = (value: unknown): boolean =>
  typeof value === "object" && value !== null;

const diffMultipleValues = (
  newValue: unknown,
  oldValue: unknown,
): ListMutation[] => {
  const newArray = Array.isArray(newValue) ? newValue : [];
  const oldArray = Array.isArray(oldValue) ? oldValue : [];

  const hasComplex = newArray.some(isComplex) || oldArray.some(isComplex);

  if (!hasComplex) {
    const oldSet = new Set(oldArray);
    const newSet = new Set(newArray);
    const mutations: ListMutation[] = [];
    for (const item of oldArray) {
      if (!newSet.has(item)) mutations.push(["remove", item]);
    }
    for (const item of newArray) {
      if (!oldSet.has(item)) mutations.push(["insert", item]);
    }
    return mutations;
  }

  // Deep-equality path for arrays containing objects/tuples
  const mutations: ListMutation[] = [];
  const matchedNew = new Set<number>();

  for (const item of oldArray) {
    const idx = newArray.findIndex(
      (n, i) => !matchedNew.has(i) && isEqual(n, item),
    );
    if (idx >= 0) matchedNew.add(idx);
    else mutations.push(["remove", item]);
  }

  for (let i = 0; i < newArray.length; i++) {
    if (!matchedNew.has(i)) mutations.push(["insert", newArray[i]]);
  }

  return mutations;
};

const collectAllFieldKeys = (
  newEntity: FieldsetNested,
  oldEntity: FieldsetNested,
): FieldKey[] => [
  ...new Set([
    ...Object.keys(newEntity),
    ...Object.keys(oldEntity),
  ] as FieldKey[]),
];

type FieldDiffResult = {
  changesets?: ChangesetsInput;
  fieldChange?: FieldValue;
};

const diffField = (
  schema: EntitySchema,
  fieldKey: FieldKey,
  newValue: FieldNestedValue,
  oldValue: FieldNestedValue,
): FieldDiffResult | null => {
  if (includes(coreIdentityFieldKeys, fieldKey)) return null;

  const fieldDef = schema.fields[fieldKey];

  if (fieldDef?.dataType === "relation" && fieldDef.allowMultiple) {
    const newChildren = extractOwnedChildren(newValue);
    const oldChildren = extractOwnedChildren(oldValue);

    if (newChildren.length > 0 || oldChildren.length > 0) {
      const result = diffOwnedChildren(
        schema,
        newChildren,
        oldChildren,
        fieldDef.range,
      );
      const fieldChange =
        result.mutations.length > 0
          ? (result.mutations as FieldValue)
          : undefined;
      return { changesets: result.changesets, fieldChange };
    }

    // No nested fieldsets (e.g. relation refs stored as strings/tuples).
    // Fall through to diffMultipleValues below.
  }

  if (fieldDef?.dataType === "relation") {
    if (isFieldsetNested(newValue)) {
      assert(
        isFieldsetNested(oldValue),
        `relation field '${fieldKey}'`,
        `oldValue must be a nested fieldset when newValue is nested (got ${typeof oldValue}). ` +
          `Ensure the navigation item or view includes the relation field.`,
      );
      return { changesets: diffSingleRelation(schema, newValue, oldValue) };
    }
  }

  if (newValue === undefined) return null;
  if (newValue === null && (oldValue === null || oldValue === undefined))
    return null;

  if (fieldDef?.allowMultiple) {
    const mutations = diffMultipleValues(newValue, oldValue);
    if (mutations.length === 0) return null;
    return { fieldChange: mutations as FieldValue };
  }

  if (!isEqual(newValue, oldValue)) {
    return { fieldChange: newValue as FieldValue };
  }

  return null;
};

export const diffEntities = (
  schema: EntitySchema,
  newEntity: FieldsetNested,
  oldEntity: FieldsetNested,
): ChangesetsInput => {
  const uid = extractUid(oldEntity);
  assertDefined(uid, "uid in diffEntities oldEntity");

  const changesets: ChangesetsInput = [];
  const fieldChanges: Record<FieldKey, FieldValue> = {};

  for (const fieldKey of collectAllFieldKeys(newEntity, oldEntity)) {
    const result = diffField(
      schema,
      fieldKey,
      newEntity[fieldKey],
      oldEntity[fieldKey],
    );
    if (!result) continue;

    if (result.changesets !== undefined) {
      changesets.push(...result.changesets);
    }
    if (result.fieldChange !== undefined) {
      fieldChanges[fieldKey] = result.fieldChange;
    }
  }

  if (Object.keys(fieldChanges).length > 0) {
    changesets.unshift({ uid, ...fieldChanges });
  }

  return changesets;
};

export type DiffQueryResult = {
  toCreate: EntityChangesetInput<"record">[];
  toUpdate: ChangesetsInput<"record">;
  toRemove: EntityUid[];
};

const hydrateEntity = (
  schema: EntitySchema,
  entity: FieldsetNested,
  queryContext: Fieldset,
): EntityChangesetInput<"record"> | null => {
  const hydrated = { ...queryContext, ...entity };
  const type = getType(hydrated);
  if (!type) return null;

  return {
    type,
    ...collectNonIdentityFields(schema, hydrated),
  } as EntityChangesetInput<"record">;
};

export const diffQueryResults = (
  schema: EntitySchema,
  newEntities: FieldsetNested[],
  oldEntities: FieldsetNested[],
  query: QueryParams,
): DiffQueryResult => {
  const toCreate: EntityChangesetInput<"record">[] = [];
  const toUpdate: ChangesetsInput<"record"> = [];

  const queryContext = extractFieldsetFromQuery(query);
  const excludeFields = new Set(Object.keys(queryContext) as FieldKey[]);

  const classifications = classifyFields(schema);
  const config: MatcherConfig = { schema, classifications, excludeFields };

  const matchResult = matchEntities(config, newEntities, oldEntities);

  for (const newIdx of matchResult.toCreate) {
    const entity = newEntities[newIdx]!;
    const hydrated = hydrateEntity(schema, entity, queryContext);
    if (hydrated) toCreate.push(hydrated);
  }

  for (const { newIndex, oldIndex } of matchResult.matches) {
    toUpdate.push(
      ...diffEntities(schema, newEntities[newIndex]!, oldEntities[oldIndex]!),
    );
  }

  const toRemove = matchResult.toRemove.map((oldIdx) => {
    const uid = extractUid(oldEntities[oldIdx]!);
    assertDefined(uid, "uid in diffQueryResults toRemove");
    return uid as EntityUid;
  });

  return { toCreate, toUpdate, toRemove };
};
