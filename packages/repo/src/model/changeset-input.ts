import { z } from "zod";
import {
  assertFailed,
  isObjTuple,
  objEntries,
  type ObjTuple,
  objTupleKey,
  objTupleToTuple,
  omit,
} from "@binder/utils";
import type { EntityRef } from "./entity.ts";
import { type FieldKey, type Fieldset, type FieldValue } from "./field.ts";
import { getMultiValueDelimiter, splitByDelimiter } from "./text-format.ts";
import {
  coerceFieldset,
  coerceFieldValue,
  type FieldDefs,
} from "./value-coercion.ts";
import type {
  EntityNsKey,
  EntityNsRef,
  EntityNsType,
  EntityNsUid,
  NamespaceEditable,
  NamespaceSchema,
} from "./namespace.ts";
import {
  type FieldChangeset,
  isValueChange,
  type ListMutation,
  type ValueChange,
  type ValueChangeDiff,
} from "./changeset.ts";
import type { OptionDef } from "./data-type.ts";
import type { FieldDef } from "./schema.ts";
import type { TextDiffOp } from "./text-diff.ts";

export type ListMutationInputValue = FieldValue | ObjTuple<string, Fieldset>;

export type ListMutationInputInsert = [
  kind: "insert",
  value: ListMutationInputValue,
  position?: number,
];
export type ListMutationInputRemove = [
  kind: "remove",
  value: ListMutationInputValue,
  position?: number,
];
export type ListMutationInputPatch = [
  kind: "patch",
  ref: string,
  attrs: Fieldset,
];

export type ListMutationInput =
  | ListMutationInputInsert
  | ListMutationInputRemove
  | ListMutationInputPatch;

/**
 * Diff-encoded text change for richtext fields configured with
 * `changeType: "diff"`. The processor stores it verbatim as a
 * `ValueChangeDiff`, and `transactionToInput` round-trips it back to this
 * form so callers that consume transactions as input see the same shape.
 */
export type FieldChangeInputDiff = [kind: "diff", ops: TextDiffOp[]];

export const isListMutationInput = (
  input: FieldChangeInput,
): input is ListMutationInput =>
  Array.isArray(input) &&
  input.length >= 2 &&
  input.length <= 3 &&
  (input[0] === "insert" || input[0] === "remove" || input[0] === "patch");

export const isListMutationInputArray = (
  input: FieldChangeInput,
): input is ListMutationInput[] =>
  Array.isArray(input) &&
  input.length > 0 &&
  input.every(
    (item) =>
      item !== undefined &&
      isListMutationInput(item as unknown as FieldChangeInput),
  );

export const isDiffInput = (
  input: FieldChangeInput,
): input is FieldChangeInputDiff =>
  Array.isArray(input) &&
  input.length === 2 &&
  input[0] === "diff" &&
  Array.isArray(input[1]);

export type FieldChangeInput =
  | FieldValue
  | ListMutationInput
  | ListMutationInput[]
  | FieldChangeInputDiff;
export type FieldChangesetInput = Record<FieldKey, FieldChangeInput>;
type EntityRefFields<N extends NamespaceEditable> =
  | { $ref: EntityNsRef[N] }
  | { uid: EntityNsUid[N] }
  | { key: EntityNsKey[N] };
export type EntityUpdate<N extends NamespaceEditable> = FieldChangesetInput &
  EntityRefFields<N>;
export type EntityCreate<N extends NamespaceEditable> = FieldChangesetInput & {
  type: EntityNsType[N];
  key?: EntityNsKey[N];
};
export type EntityDelete<N extends NamespaceEditable> = EntityRefFields<N> & {
  $delete: true;
};
export type EntityMutationInput<N extends NamespaceEditable> =
  | EntityUpdate<N>
  | EntityCreate<N>;
export type EntityChangesetInput<N extends NamespaceEditable> =
  | EntityMutationInput<N>
  | EntityDelete<N>;

export type ChangesetsInput<N extends NamespaceEditable = NamespaceEditable> =
  EntityChangesetInput<N>[];

export const changesetInputForNewEntity = <N extends NamespaceEditable>(
  entity: Fieldset,
): EntityChangesetInput<N> => omit(entity, ["id"]) as EntityChangesetInput<N>;

const hasRefField = (input: Record<string, unknown>): boolean =>
  ("$ref" in input || "uid" in input || "key" in input) && !("type" in input);

export const isEntityDelete = <N extends NamespaceEditable>(
  input: EntityChangesetInput<N>,
): input is EntityDelete<N> =>
  hasRefField(input) && "$delete" in input && input.$delete === true;

export const isEntityUpdate = <N extends NamespaceEditable>(
  input: EntityChangesetInput<N>,
): input is EntityUpdate<N> => hasRefField(input) && !isEntityDelete(input);

/**
 * True when the input carries `type`. Only creates name a `type`; updates and
 * deletes target an existing entity by ref and never restate it, so `type` is
 * the signal of create intent. The match may still resolve to an update when an
 * entity with the same key/uid already exists (upsert).
 */
export const isEntityCreate = <N extends NamespaceEditable>(
  input: EntityChangesetInput<N>,
): input is EntityCreate<N> => "type" in input;

/** Extract the entity ref from an update/delete input. Works before and after normalization. */
export const getEntityInputRef = <N extends NamespaceEditable>(
  input: EntityUpdate<N> | EntityDelete<N>,
): EntityRef => {
  const raw = input as Record<string, unknown>;
  return (raw.$ref ?? raw.uid ?? raw.key) as EntityRef;
};

export const getMutationInputRef = (value: ListMutationInputValue): string =>
  isObjTuple(value) ? objTupleKey(value) : (value as string);

const normalizeItemInputValue = (value: ListMutationInputValue): FieldValue =>
  isObjTuple(value) ? objTupleToTuple(value) : value;

export const normalizeInputValue = (value: FieldValue): FieldValue =>
  Array.isArray(value)
    ? value.map(normalizeItemInputValue)
    : normalizeItemInputValue(value);

const isRefTuple = (value: unknown): value is [string, Fieldset] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === "string" &&
  typeof value[1] === "object" &&
  value[1] !== null &&
  !Array.isArray(value[1]);

/** Read the attributes of relation tuples as the types of the attribute fields. */
const coerceRelationAttrs = (
  value: FieldValue,
  schema: FieldDefs,
): FieldValue => {
  if (!Array.isArray(value)) return value;
  if (isRefTuple(value)) return [value[0], coerceFieldset(value[1], schema)];
  return value.map((item) =>
    isRefTuple(item) ? [item[0], coerceFieldset(item[1], schema)] : item,
  );
};

/**
 * Convert an input value to its stored shape and read it as the type of the
 * field. Without a field definition the value only changes shape.
 */
const normalizeFieldInputValue = (
  value: ListMutationInputValue,
  fieldDef?: FieldDef,
  schema?: FieldDefs,
): FieldValue => {
  const item = normalizeInputValue(value as FieldValue);
  if (!fieldDef) return item;
  const coerced = coerceFieldValue(fieldDef, item);
  return fieldDef.dataType === "relation" && schema
    ? coerceRelationAttrs(coerced, schema)
    : coerced;
};

export const normalizeListMutationInput = (
  input: ListMutationInput,
  fieldDef?: FieldDef,
  schema?: FieldDefs,
): ListMutation => {
  if (input[0] === "patch") {
    const ref = fieldDef ? coerceFieldValue(fieldDef, input[1]) : input[1];
    return [
      "patch",
      ref as string,
      normalizeFieldChangesetInput(input[2], schema),
    ];
  }

  const [kind, value, position] = input;
  const normalized = normalizeFieldInputValue(value, fieldDef, schema);
  return position !== undefined
    ? [kind, normalized, position]
    : [kind, normalized];
};

export const normalizeFieldChangesetInput = (
  input: FieldChangesetInput,
  schema?: FieldDefs,
): FieldChangeset => {
  const result: FieldChangeset = {};
  for (const [key, value] of objEntries(input)) {
    const fieldDef = schema?.fields[key];
    if (isDiffInput(value)) {
      result[key] = ["diff", value[1]] satisfies ValueChangeDiff;
    } else if (isListMutationInputArray(value)) {
      result[key] = [
        "seq",
        value.map((mutation) =>
          normalizeListMutationInput(mutation, fieldDef, schema),
        ),
      ];
    } else if (isListMutationInput(value)) {
      result[key] = [
        "seq",
        [normalizeListMutationInput(value, fieldDef, schema)],
      ];
    } else {
      result[key] = normalizeFieldInputValue(
        value as FieldValue,
        fieldDef,
        schema,
      );
    }
  }
  return result;
};

export type OptionDefInput = string | OptionDef;

export const normalizeOptionDef = (item: OptionDefInput): OptionDef =>
  typeof item === "string" ? { key: item } : item;

export const normalizeOptionSet = (options: OptionDefInput[]): OptionDef[] =>
  options.map(normalizeOptionDef);

const normalizeFieldValue = (
  fieldDef: FieldDef | undefined,
  value: FieldValue,
  schema: FieldDefs,
): FieldValue | ListMutation | ListMutation[] | FieldChangeInputDiff => {
  if (isDiffInput(value as unknown as FieldChangeInput)) {
    return value as unknown as FieldChangeInputDiff;
  }
  if (isListMutationInputArray(value)) {
    return value.map((mutation) =>
      normalizeListMutationInput(mutation, fieldDef, schema),
    );
  }
  if (isListMutationInput(value)) {
    return normalizeListMutationInput(value, fieldDef, schema);
  }
  if (fieldDef?.dataType === "optionSet" && Array.isArray(value)) {
    return normalizeOptionSet(value as OptionDefInput[]);
  }
  if (fieldDef?.dataType === "relation") {
    return normalizeFieldInputValue(value, fieldDef, schema);
  }
  const coerced = fieldDef ? coerceFieldValue(fieldDef, value) : value;
  if (fieldDef?.allowMultiple && !Array.isArray(coerced)) {
    if (
      typeof coerced === "string" &&
      (fieldDef.dataType === "plaintext" || fieldDef.dataType === "richtext")
    ) {
      const delimiter = getMultiValueDelimiter(fieldDef);
      return splitByDelimiter(coerced, delimiter, fieldDef.sectionDepth).filter(
        (item) => item.length > 0,
      );
    }
    return [coerced];
  }
  return coerced;
};

/**
 * Collapse external `key`/`uid` ref aliases into the canonical `$ref` field.
 * - `{ uid, ... }` (no `type`) → `$ref = uid`, drop `uid`, keep `key` as data
 * - `{ key, ... }` (no `uid`, no `type`) → `$ref = key`, drop `key`
 * - `{ $ref, ... }` → pass through
 * - `{ $ref, key/uid }` → conflicting, `$ref` wins, `key`/`uid` kept as data
 */
const collapseRefAliases = <N extends NamespaceEditable>(
  input: EntityChangesetInput<N>,
): EntityChangesetInput<N> => {
  if ("$ref" in input || "type" in input) return input;
  const raw = input as Record<string, unknown>;
  if ("uid" in raw) {
    const { uid, ...rest } = raw;
    return { $ref: uid, ...rest } as EntityChangesetInput<N>;
  }
  if ("key" in raw) {
    const { key, ...rest } = raw;
    return { $ref: key, ...rest } as EntityChangesetInput<N>;
  }
  return input;
};

export const normalizeInput = <N extends NamespaceEditable>(
  input: EntityChangesetInput<N>,
  schema: NamespaceSchema<N>,
): EntityChangesetInput<N> => {
  const collapsed = collapseRefAliases(input);
  if (isEntityDelete(collapsed)) return collapsed;
  const normalized: EntityChangesetInput<N> = { ...collapsed };

  for (const [fieldKey, value] of objEntries(collapsed)) {
    if (fieldKey === "$ref" || fieldKey === "type" || value === undefined)
      continue;

    const fieldDef = schema.fields[fieldKey];
    normalized[fieldKey] = normalizeFieldValue(
      fieldDef,
      value as FieldValue,
      schema,
    ) as typeof value;
  }

  // `default` and `value` hold a value of the field being defined.
  const dataType = (collapsed as Record<string, unknown>)["dataType"];
  if (typeof dataType === "string") {
    for (const key of ["default", "value"]) {
      const held = (normalized as Record<string, FieldValue>)[key];
      if (held !== undefined)
        (normalized as Record<string, FieldValue>)[key] = coerceFieldValue(
          { dataType },
          held,
        );
    }
  }

  return normalized;
};

const valueChangeToInput = (change: ValueChange): FieldChangeInput => {
  if (change[0] === "set") return change[1];
  if (change[0] === "clear") return null;
  if (change[0] === "seq")
    return change[1].map((m: ListMutation) =>
      m[0] === "patch"
        ? ([m[0], m[1], changesetToInput(m[2])] as ListMutationInput)
        : m,
    );
  if (change[0] === "patch") return changesetToInput(change[1]) as FieldValue;
  if (change[0] === "diff") return ["diff", change[1]];
  assertFailed("Unknown change kind");
};

export const changesetToInput = (
  changeset: FieldChangeset,
): FieldChangesetInput => {
  const result: FieldChangesetInput = {};
  for (const [key, value] of objEntries(changeset)) {
    if (key === "id") continue;
    result[key] = isValueChange(value)
      ? valueChangeToInput(value)
      : (value as FieldChangeInput);
  }
  return result;
};

export const EntityCreateInputSchema = z
  .object({ type: z.string(), key: z.string().optional() })
  .passthrough()
  .transform((val) => val as EntityCreate<NamespaceEditable>);

export const EntityUpdateInputSchema = z
  .union([
    z.object({ $ref: z.string() }).passthrough(),
    z.object({ key: z.string() }).passthrough(),
    z.object({ uid: z.string() }).passthrough(),
  ])
  .transform((val) => val as EntityUpdate<NamespaceEditable>);

export const EntityDeleteInputSchema = z
  .union([
    z.object({ $ref: z.string(), $delete: z.literal(true) }).strict(),
    z.object({ key: z.string(), $delete: z.literal(true) }).strict(),
    z.object({ uid: z.string(), $delete: z.literal(true) }).strict(),
  ])
  .transform((val) => val as EntityDelete<NamespaceEditable>);
