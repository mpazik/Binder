import { wrapError, fail, isErr, ok, type Result } from "@binder/utils";
import {
  isIncludesQuery,
  RangeFilterSchema,
  type ComplexFilter,
  type Filter,
  type FilterOperator,
  type Filters,
  type Includes,
  type IncludesQuery,
  type OrderBy,
} from "./query.ts";
import { IDENTIFIER_FORMAT_PATTERN } from "./text-format.ts";

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

export const coerceFilterValue = (raw: string): string | number | boolean => {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
  return raw;
};

const coerceListValue = (raw: string): (string | number)[] =>
  raw.split(",").map((v) => {
    const trimmed = v.trim();
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    return trimmed;
  });

// ---------------------------------------------------------------------------
// Filters — parse
// ---------------------------------------------------------------------------

type OperatorMatch = {
  field: string;
  op: FilterOperator | "eq";
  rawValue: string;
};

const namedOperators: {
  suffix: string;
  op: FilterOperator;
  hasValue: boolean;
}[] = [
  { suffix: ":notContains=", op: "notContains", hasValue: true },
  { suffix: ":contains=", op: "contains", hasValue: true },
  { suffix: ":notEmpty", op: "empty", hasValue: false },
  { suffix: ":empty", op: "empty", hasValue: false },
  { suffix: ":notIn=", op: "notIn", hasValue: true },
  { suffix: ":match=", op: "match", hasValue: true },
  { suffix: ":in=", op: "in", hasValue: true },
  { suffix: ":range=", op: "range", hasValue: true },
];

const symbolicOperators: { symbol: string; op: FilterOperator }[] = [
  { symbol: "!=", op: "not" },
  { symbol: ">=", op: "gte" },
  { symbol: "<=", op: "lte" },
  { symbol: ">", op: "gt" },
  { symbol: "<", op: "lt" },
];

const matchSerialFilter = (token: string): OperatorMatch | null => {
  // Only an operator immediately following a valid field starts a predicate.
  // Operator characters inside its value must not change the field/operator.
  // $text is the reserved full-text equality field, not a general $ prefix.
  const field = token.match(/^(?:\$text(?==)|[A-Za-z][A-Za-z0-9_-]*)/)?.[0];
  if (!field) return null;
  const rest = token.slice(field.length);

  // Named operators (colon-prefixed)
  for (const { suffix, op, hasValue } of namedOperators) {
    if (rest.startsWith(suffix)) {
      const valueOffset = field.length + suffix.length;
      if (!hasValue && token[valueOffset] && !/\s/.test(token[valueOffset]!))
        continue;
      const rawValue = hasValue ? token.slice(valueOffset) : "";
      // :notEmpty → op "empty" but value is negated
      const isNegated = suffix.startsWith(":not") && !hasValue;
      return {
        field,
        op,
        rawValue: isNegated ? "__notEmpty__" : rawValue,
      };
    }
  }

  // Symbolic operators
  for (const { symbol, op } of symbolicOperators) {
    if (rest.startsWith(symbol)) {
      const valueOffset = field.length + symbol.length;
      return { field, op, rawValue: token.slice(valueOffset) };
    }
  }

  // Simple equality
  if (rest.startsWith("=")) {
    const valueOffset = field.length + 1;
    return { field, op: "eq", rawValue: token.slice(valueOffset) };
  }

  return null;
};

const parseRange = (value: unknown, field: string): Result<Filter> => {
  const parsed = RangeFilterSchema.safeParse({ op: "range", value });
  return parsed.success
    ? ok(parsed.data)
    : fail(
        "invalid-range-filter",
        `Filter field '${field}': range requires two matching numeric, date, datetime, or period endpoints`,
        { data: { field } },
      );
};

const buildFilter = (match: OperatorMatch): Result<Filter> => {
  const { op, rawValue } = match;

  if (op === "eq") return ok(coerceFilterValue(rawValue));

  if (op === "range") {
    const interval = /^([[(])([^,]+),([^,]+)([)\]])$/.exec(rawValue.trim());
    const endpoint = (raw: string, inclusive: boolean) => {
      const text = raw.trim();
      // Quoted year labels distinguish period strings from numeric endpoints.
      const value = /^"\d{4}"$/.test(text)
        ? text.slice(1, -1)
        : /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)
          ? Number(text)
          : text;
      return inclusive ? value : { value, inclusive: false };
    };
    return parseRange(
      interval
        ? [
            endpoint(interval[2]!, interval[1] === "["),
            endpoint(interval[3]!, interval[4] === "]"),
          ]
        : undefined,
      match.field,
    );
  }

  if (op === "empty") {
    return ok({ op: "empty", value: rawValue !== "__notEmpty__" });
  }

  if (op === "in" || op === "notIn") {
    return ok({ op, value: coerceListValue(rawValue) });
  }

  return ok({ op, value: coerceFilterValue(rawValue) } as ComplexFilter);
};

const getInValues = (filter: Filter): (string | number)[] | null => {
  if (typeof filter === "string" || typeof filter === "number") return [filter];
  if (
    typeof filter === "object" &&
    !Array.isArray(filter) &&
    filter.op === "in" &&
    Array.isArray(filter.value)
  )
    return filter.value;
  return null;
};

const getExcludedValues = (filter: Filter): (string | number)[] | null => {
  if (typeof filter !== "object" || Array.isArray(filter)) return null;
  if (
    filter.op === "not" &&
    (typeof filter.value === "string" || typeof filter.value === "number")
  )
    return [filter.value];
  if (filter.op === "notIn" && Array.isArray(filter.value)) return filter.value;
  return null;
};

type Bound = { value: string | number; inclusive: boolean };
type Bounds = { lower?: Bound; upper?: Bound };

const getBounds = (filter: Filter): Bounds | undefined => {
  if (typeof filter !== "object" || Array.isArray(filter)) return undefined;
  if (filter.op === "range") {
    const endpoint = (value: (typeof filter.value)[number]): Bound =>
      typeof value === "object" ? value : { value, inclusive: true };
    return {
      lower: endpoint(filter.value[0]),
      upper: endpoint(filter.value[1]),
    };
  }
  if (typeof filter.value !== "string" && typeof filter.value !== "number")
    return undefined;
  switch (filter.op) {
    case "gt":
    case "gte":
      return { lower: { value: filter.value, inclusive: filter.op === "gte" } };
    case "lt":
    case "lte":
      return { upper: { value: filter.value, inclusive: filter.op === "lte" } };
    default:
      return undefined;
  }
};

const tighterBound = (
  a: Bound | undefined,
  b: Bound | undefined,
  lower: boolean,
): Bound | undefined => {
  if (!a) return b;
  if (!b) return a;
  if (a.value === b.value)
    return { value: a.value, inclusive: a.inclusive && b.inclusive };
  return (lower ? a.value > b.value : a.value < b.value) ? a : b;
};

const mergeFilter = (
  existing: Filter,
  incoming: Filter,
  field: string,
): Result<Filter> => {
  const incompatible = () =>
    fail(
      "incompatible-filters",
      `Filter field '${field}': cannot combine these predicates. Use equality/in, not/notIn, or compatible range bounds.`,
      { data: { field } },
    );
  if (field === "$text") return incompatible();
  const existingValues = getInValues(existing);
  const incomingValues = getInValues(incoming);
  if (existingValues && incomingValues)
    return ok({ op: "in", value: [...existingValues, ...incomingValues] });
  const excluded = getExcludedValues(existing);
  const incomingExcluded = getExcludedValues(incoming);
  if (excluded && incomingExcluded)
    return ok({ op: "notIn", value: [...excluded, ...incomingExcluded] });
  const a = getBounds(existing);
  const b = getBounds(incoming);
  if (!a || !b) return incompatible();
  // Validate categories before comparing, including same-direction bounds.
  const compatible = parseRange(
    [(a.lower ?? a.upper)!.value, (b.lower ?? b.upper)!.value],
    field,
  );
  if (isErr(compatible)) return compatible;
  const lower = tighterBound(a.lower, b.lower, true);
  const upper = tighterBound(a.upper, b.upper, false);
  if (lower && upper) {
    const endpoint = (bound: Bound) => (bound.inclusive ? bound.value : bound);
    return parseRange([endpoint(lower), endpoint(upper)], field);
  }
  const bound = (lower ?? upper)!;
  return ok({
    op: lower
      ? bound.inclusive
        ? "gte"
        : "gt"
      : bound.inclusive
        ? "lte"
        : "lt",
    value: bound.value,
  });
};

/**
 * Parse an array of serial filter tokens into a Filters object.
 * Invalid ranges and incompatible repeated predicates return structured errors.
 *
 * Tokens without an operator are collected as plain text (`$text`).
 *
 * @example
 * parseSerialFilters(["type=Task", "priority>=3", "urgent"])
 * // → ok({ type: "Task", priority: { op: "gte", value: 3 }, $text: "urgent" })
 */
export const parseSerialFilters = (parts: string[]): Result<Filters> => {
  const filters: Filters = {};
  const plainTextParts: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = matchSerialFilter(trimmed);
    if (!match) {
      plainTextParts.push(trimmed);
      continue;
    }

    const newFilter = buildFilter(match);
    if (isErr(newFilter)) return newFilter;
    const existing = filters[match.field];
    const merged =
      existing !== undefined
        ? mergeFilter(existing, newFilter.data, match.field)
        : newFilter;
    if (isErr(merged)) return merged;
    filters[match.field] = merged.data;
  }

  if (plainTextParts.length > 0) {
    if (filters["$text"] !== undefined)
      return fail(
        "incompatible-filters",
        "Cannot combine $text= with plain text search terms",
        { data: { field: "$text" } },
      );
    filters["$text"] = plainTextParts.join(" ");
  }

  return ok(filters);
};

// ---------------------------------------------------------------------------
// Filters — serialize
// ---------------------------------------------------------------------------

const opToSymbol: Partial<Record<FilterOperator, string>> = {
  not: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

const opToNamed: Partial<Record<FilterOperator, string>> = {
  in: ":in=",
  notIn: ":notIn=",
  match: ":match=",
  contains: ":contains=",
  notContains: ":notContains=",
};

const serializeFilterEntry = (field: string, filter: Filter): string => {
  if (
    typeof filter === "string" ||
    typeof filter === "number" ||
    typeof filter === "boolean"
  ) {
    return `${field}=${filter}`;
  }

  if (Array.isArray(filter)) {
    return `${field}:in=${filter.join(",")}`;
  }

  const { op, value } = filter;

  if (op === "range") {
    const [lower, upper] = value.map((endpoint) =>
      typeof endpoint === "object"
        ? endpoint
        : { value: endpoint, inclusive: true },
    );
    const serialValue = (value: string | number) =>
      typeof value === "string" && /^\d{4}$/.test(value)
        ? JSON.stringify(value)
        : value;
    return `${field}:range=${lower!.inclusive ? "[" : "("}${serialValue(lower!.value)},${serialValue(upper!.value)}${upper!.inclusive ? "]" : ")"}`;
  }

  if (op === "empty") {
    return value ? `${field}:empty` : `${field}:notEmpty`;
  }

  const sym = opToSymbol[op];
  if (sym) return `${field}${sym}${value}`;

  const named = opToNamed[op];
  if (named) {
    if (Array.isArray(value)) return `${field}${named}${value.join(",")}`;
    return `${field}${named}${value}`;
  }

  return `${field}=${value}`;
};

/**
 * Serialize a Filters object into an array of serial tokens.
 *
 * @example
 * serializeFilters({ type: "Task", priority: { op: "gte", value: 3 } })
 * // → ["type=Task", "priority>=3"]
 */
export const serializeFilters = (filters: Filters): string[] => {
  const parts: string[] = [];
  for (const [field, filter] of Object.entries(filters)) {
    if (field === "$text") {
      if (typeof filter === "string") parts.push(filter);
      continue;
    }
    parts.push(serializeFilterEntry(field, filter));
  }
  return parts;
};

// ---------------------------------------------------------------------------
// Includes — parse
// ---------------------------------------------------------------------------

// Range intervals are opaque to include delimiters: [a,b) is not mismatched nesting.
function* structuralCharacters(input: string) {
  for (let index = 0; index < input.length; index++) {
    if (input.startsWith(":range=", index)) {
      const interval = /^:range=[[(][^()[\]]*[)\]]/.exec(input.slice(index));
      if (interval) {
        index += interval[0].length - 1;
        continue;
      }
    }
    yield { ch: input[index]!, index };
  }
}

const findCloseBracket = (input: string, open: number): number => {
  let depth = 0;
  for (const { ch, index } of structuralCharacters(input)) {
    if (index < open) continue;
    if (ch === "[") depth++;
    if (ch === "]" && --depth === 0) return index;
  }
  return -1;
};

const splitTopLevel = (input: string): string[] => {
  const segments: string[] = [];
  let parenDepth = 0;
  let bracketDepth = 0;
  let start = 0;

  for (const { ch, index: i } of structuralCharacters(input)) {
    if (ch === "(") parenDepth++;
    else if (ch === ")") parenDepth--;
    else if (ch === "[") bracketDepth++;
    else if (ch === "]") bracketDepth--;
    else if (ch === "," && parenDepth === 0 && bracketDepth === 0) {
      segments.push(input.slice(start, i));
      start = i + 1;
    }
  }

  segments.push(input.slice(start));
  return segments;
};

const parseIncludesInner = (input: string): Result<Includes> => {
  const trimmed = input.trim();
  if (!trimmed) return fail("empty-includes", "Includes cannot be empty");

  const segments = splitTopLevel(trimmed);
  const includes: Includes = {};

  for (const segment of segments) {
    const seg = segment.trim();
    if (!seg) return fail("empty-field-name", "Empty field name in includes");

    const bracketIdx = seg.indexOf("[");
    const parenIdx = seg.indexOf("(");

    if (bracketIdx === -1 && parenIdx === -1) {
      // Simple field: "title"
      if (!IDENTIFIER_FORMAT_PATTERN.test(seg)) {
        return fail("invalid-field-name", `Invalid field name: '${seg}'`, {
          data: { field: seg },
        });
      }
      includes[seg] = true;
    } else if (
      bracketIdx !== -1 &&
      (parenIdx === -1 || bracketIdx < parenIdx)
    ) {
      // Filtered field: "field[filters]" or "field[filters](subfields)"
      const fieldName = seg.slice(0, bracketIdx).trim();
      if (!fieldName || !IDENTIFIER_FORMAT_PATTERN.test(fieldName)) {
        return fail(
          "invalid-field-name",
          `Invalid field name: '${fieldName}'`,
          { data: { field: fieldName } },
        );
      }

      const closeBracketIdx = findCloseBracket(seg, bracketIdx);
      if (closeBracketIdx === -1) {
        return fail("unmatched-bracket", "Unmatched opening bracket", {
          data: { field: fieldName },
        });
      }

      const filterStr = seg.slice(bracketIdx + 1, closeBracketIdx).trim();
      if (!filterStr) {
        return fail("empty-filter", "Empty filter in brackets", {
          data: { field: fieldName },
        });
      }

      const filterTokens: string[] = [];
      for (const part of splitTopLevel(filterStr)) {
        const token = part.trim();
        const last = filterTokens.at(-1);
        const previous = last === undefined ? null : matchSerialFilter(last);
        // Commas separate both predicates and in/notIn values. A new
        // predicate ends a list; otherwise retain the next list item.
        if (
          previous &&
          (previous.op === "in" || previous.op === "notIn") &&
          !matchSerialFilter(token)
        ) {
          filterTokens[filterTokens.length - 1] = `${last},${token}`;
        } else {
          filterTokens.push(token);
        }
      }
      const filters = parseSerialFilters(filterTokens);
      if (isErr(filters))
        return wrapError(
          filters,
          filters.error.key,
          `Invalid filter in include '${fieldName}': ${filters.error.message}`,
        );
      const query: IncludesQuery = { filters: filters.data };

      const afterBracket = seg.slice(closeBracketIdx + 1).trim();
      if (afterBracket) {
        // Expect "(subfields)"
        if (!afterBracket.startsWith("(") || !afterBracket.endsWith(")")) {
          return fail(
            "unmatched-paren",
            "Unmatched parenthesis after bracket",
            {
              data: { field: fieldName },
            },
          );
        }
        const inner = afterBracket.slice(1, -1);
        const result = parseIncludesInner(inner);
        if (isErr(result)) return result;
        query.includes = result.data;
      }

      includes[fieldName] = query;
    } else {
      // Nested field without filter: "field(subfields)"
      const fieldName = seg.slice(0, parenIdx).trim();
      if (!fieldName || !IDENTIFIER_FORMAT_PATTERN.test(fieldName)) {
        return fail(
          "invalid-field-name",
          `Invalid field name: '${fieldName}'`,
          { data: { field: fieldName } },
        );
      }

      if (!seg.endsWith(")")) {
        return fail("unmatched-paren", "Unmatched opening parenthesis", {
          data: { field: fieldName },
        });
      }

      const inner = seg.slice(parenIdx + 1, -1);
      const result = parseIncludesInner(inner);
      if (isErr(result)) return result;
      includes[fieldName] = result.data;
    }
  }

  return ok(includes);
};

/**
 * Parse a serial includes string into an Includes object.
 *
 * @example
 * parseSerialIncludes("project(title,owner(name)),tags")
 * // → { project: { title: true, owner: { name: true } }, tags: true }
 */
export const parseSerialIncludes = (input: string): Result<Includes> => {
  const trimmed = input.trim();
  if (!trimmed) return fail("empty-includes", "Includes cannot be empty");

  // Check for unmatched parentheses and brackets
  let parenDepth = 0;
  let bracketDepth = 0;
  let lastCloseParen = -1;
  for (const { ch, index: i } of structuralCharacters(trimmed)) {
    if (ch === "(") parenDepth++;
    else if (ch === ")") {
      parenDepth--;
      lastCloseParen = i;
    } else if (ch === "[") {
      if (lastCloseParen !== -1 && parenDepth === 0) {
        // Check if this bracket follows a paren at the same nesting level
        // e.g. "field(title)[type=Task]" — brackets must come before parens
        const between = trimmed.slice(lastCloseParen + 1, i).trim();
        if (!between.includes(",")) {
          return fail(
            "brackets-after-parens",
            "Brackets must appear before parentheses",
          );
        }
      }
      bracketDepth++;
    } else if (ch === "]") bracketDepth--;
    if (parenDepth < 0)
      return fail("unmatched-paren", "Unmatched closing parenthesis");
    if (bracketDepth < 0)
      return fail("unmatched-bracket", "Unmatched closing bracket");
  }
  if (parenDepth !== 0)
    return fail("unmatched-paren", "Unmatched opening parenthesis");
  if (bracketDepth !== 0)
    return fail("unmatched-bracket", "Unmatched opening bracket");

  return parseIncludesInner(trimmed);
};

// ---------------------------------------------------------------------------
// Includes — serialize
// ---------------------------------------------------------------------------

/**
 * Serialize an Includes object into the serial parenthesized format.
 *
 * @example
 * serializeIncludes({ project: { title: true }, tags: true })
 * // → "project(title),tags"
 */
export const serializeIncludes = (includes: Includes): string => {
  const parts: string[] = [];

  for (const [field, value] of Object.entries(includes)) {
    if (value === false) continue;
    if (value === true) {
      parts.push(field);
    } else if (isIncludesQuery(value)) {
      let part = field;
      if (value.filters && Object.keys(value.filters).length > 0) {
        part += `[${serializeFilters(value.filters).join(",")}]`;
      }
      if (value.includes && Object.keys(value.includes).length > 0) {
        part += `(${serializeIncludes(value.includes)})`;
      }
      parts.push(part);
    } else {
      parts.push(`${field}(${serializeIncludes(value as Includes)})`);
    }
  }

  return parts.join(",");
};

// ---------------------------------------------------------------------------
// OrderBy — parse / serialize
// ---------------------------------------------------------------------------

/**
 * Parse a serial orderBy string into an OrderBy array.
 *
 * @example
 * parseSerialOrderBy("!priority,createdAt")
 * // → ["!priority", "createdAt"]
 */
export const parseSerialOrderBy = (input: string): OrderBy =>
  input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Serialize an OrderBy array into the serial format.
 *
 * @example
 * serializeOrderBy(["!priority", "createdAt"])
 * // → "!priority,createdAt"
 */
export const serializeOrderBy = (orderBy: OrderBy): string => orderBy.join(",");
