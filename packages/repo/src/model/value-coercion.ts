import { includes } from "@binder/utils";
import { configDataTypes } from "./config-schema.ts";
import type { FieldDataTypeDefs, ValueKind } from "./data-type.ts";
import type { FieldValue } from "./field.ts";
import { type Filter, type Filters, textFilterOperators } from "./query.ts";
import { recordDataTypes } from "./record-schema.ts";
import type { FieldDef } from "./schema.ts";

/**
 * Reads incoming values as the data type of the field they belong to.
 *
 * Input formats guess types without the schema. YAML reads `2026` as a number
 * and JSON clients may send `"5"` for an integer. The field definition knows
 * the intended type, so this module is the single place that maps a value to
 * it. A value that cannot be mapped without loss is returned unchanged, and
 * validation reports it.
 */

export type FieldDefs = {
  fields: Record<string, FieldDef | undefined>;
};

const fieldDataTypes: FieldDataTypeDefs = {
  ...configDataTypes,
  ...recordDataTypes,
};

const getValueKind = (dataType: string): ValueKind | undefined =>
  fieldDataTypes[dataType]?.valueKind;

const toNumber = (text: string): number | undefined => {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : undefined;
};

const coerceScalar = (dataType: string, value: FieldValue): FieldValue => {
  const kind = getValueKind(dataType);
  if (kind === "text" || kind === "reference") {
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    if (typeof value === "boolean") return String(value);
    return value;
  }
  if (typeof value !== "string") return value;

  if (kind === "integer") {
    const number = toNumber(value);
    return number !== undefined && Number.isInteger(number) ? number : value;
  }
  if (kind === "decimal") return toNumber(value) ?? value;
  if (kind === "boolean") {
    const lower = value.trim().toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  return value;
};

export const coerceFieldValue = (
  fieldDef: Pick<FieldDef, "dataType">,
  value: FieldValue,
): FieldValue =>
  Array.isArray(value)
    ? value.map((item) => coerceScalar(fieldDef.dataType, item as FieldValue))
    : coerceScalar(fieldDef.dataType, value);

export const coerceFieldAttrs = <
  T extends { default?: FieldValue; value?: FieldValue },
>(
  attrs: T,
  fieldDef: Pick<FieldDef, "dataType">,
): T => ({
  ...attrs,
  ...(attrs.default !== undefined && {
    default: coerceFieldValue(fieldDef, attrs.default),
  }),
  ...(attrs.value !== undefined && {
    value: coerceFieldValue(fieldDef, attrs.value),
  }),
});

export const coerceFieldset = <T extends Record<string, FieldValue>>(
  fieldset: T,
  schema: FieldDefs,
): T => {
  const result: Record<string, FieldValue> = { ...fieldset };
  for (const [key, value] of Object.entries(fieldset)) {
    const fieldDef = schema.fields[key];
    if (fieldDef) result[key] = coerceFieldValue(fieldDef, value);
  }
  return result as T;
};

const coerceFilterEndpoint = (
  fieldDef: FieldDef,
  endpoint: unknown,
): unknown => {
  if (typeof endpoint === "object" && endpoint !== null)
    return {
      ...endpoint,
      value: coerceFieldValue(
        fieldDef,
        (endpoint as { value: FieldValue }).value,
      ),
    };
  return coerceFieldValue(fieldDef, endpoint as FieldValue);
};

const coerceFilter = (fieldDef: FieldDef, filter: Filter): Filter => {
  if (typeof filter !== "object" || Array.isArray(filter))
    return coerceFieldValue(fieldDef, filter) as Filter;
  if (filter.op === "empty") return filter;
  // On a non-text field, reading "12" as a number would make a text operator
  // match nothing.
  if (
    includes(textFilterOperators, filter.op) &&
    getValueKind(fieldDef.dataType) !== "text"
  )
    return filter;
  if (filter.op === "range")
    return {
      ...filter,
      value: filter.value.map((endpoint) =>
        coerceFilterEndpoint(fieldDef, endpoint),
      ),
    } as Filter;
  return {
    ...filter,
    value: coerceFieldValue(fieldDef, filter.value),
  } as Filter;
};

/** Coerce filter values by the field each filter names. */
export const coerceFilters = (filters: Filters, schema: FieldDefs): Filters => {
  const result: Filters = {};
  for (const [fieldKey, filter] of Object.entries(filters)) {
    const fieldDef = schema.fields[fieldKey];
    result[fieldKey] =
      fieldDef && getValueKind(fieldDef.dataType) !== "reference"
        ? coerceFilter(fieldDef, filter)
        : filter;
  }
  return result;
};
