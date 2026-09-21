import { describe, expect, it } from "bun:test";
import { throwIfError } from "@binder/utils";
import "@binder/utils/tests";
import { openDb } from "./db.ts";
import { recordTable } from "./schema.ts";
import {
  FiltersSchema,
  type FieldValue,
  type Filters,
  type EntitySchema,
  type FieldDef,
  type EntityKey,
  type PeriodFormat,
} from "./model";
import {
  matchesFilter,
  matchesFilters,
  getSearchableFields,
  buildWhereClause,
  normalizeFilters,
} from "./filter-entities.ts";
import { mockRecordSchema } from "./model/schema.mock.ts";

describe("range SQL and in-memory evaluation", () => {
  const periodField = (key: string, periodFormat?: PeriodFormat): FieldDef => ({
    ...mockRecordSchema.fields.dueDate!,
    key: key as EntityKey,
    dataType: "period",
    periodFormat,
  });
  const periodSchema: EntitySchema = {
    ...mockRecordSchema,
    fields: {
      ...mockRecordSchema.fields,
      weekPeriod: periodField("weekPeriod", "week"),
      monthPeriod: periodField("monthPeriod", "month"),
      quarterPeriod: periodField("quarterPeriod", "quarter"),
      yearPeriod: periodField("yearPeriod", "year"),
      dayPeriod: periodField("dayPeriod"),
    },
  };
  const checkRange = (
    field: string,
    value: unknown,
    candidates: (FieldValue | undefined)[],
    expected: number[],
    schema: EntitySchema = mockRecordSchema,
  ): void => {
    const filters = FiltersSchema.parse({ [field]: { op: "range", value } });
    const db = throwIfError(openDb({ memory: true }));
    using sqlite = db.$client;
    const insert = sqlite.query(
      "INSERT INTO records (id, uid, type, fields) VALUES (?, ?, 'Task', ?)",
    );
    candidates.forEach((candidate, index) => {
      insert.run(
        index + 1,
        `range-${index}`,
        JSON.stringify({ [field]: candidate }),
      );
    });
    const rows = db
      .select({ id: recordTable.id })
      .from(recordTable)
      .where(buildWhereClause(recordTable, filters, schema))
      .orderBy(recordTable.id)
      .all();
    const memory = candidates.flatMap((candidate, index) =>
      matchesFilters(
        filters,
        candidate === undefined ? {} : { [field]: candidate },
        schema,
      )
        ? [index + 1]
        : [],
    );
    expect({ sql: rows.map((row) => Number(row.id)), memory }).toEqual({
      sql: expected,
      memory: expected,
    });
  };

  const checkInvalidField = async (
    filters: Filters,
    schema: EntitySchema = mockRecordSchema,
  ): Promise<void> => {
    const db = throwIfError(openDb({ memory: true }));
    using _sqlite = db.$client;
    const result = await db.transaction((tx) =>
      normalizeFilters(tx, "record", filters, schema),
    );
    expect(result).toBeErrWithKey("invalid-filter-value");
  };

  it("includes both numeric boundaries by default", () =>
    checkRange("price", [3, 9], [2, 3, 5, 9, 10], [2, 3, 4]));
  it("supports an exclusive upper endpoint", () =>
    checkRange(
      "price",
      [3, { value: 9, inclusive: false }],
      [2, 3, 5, 9, 10],
      [2, 3],
    ));
  it("supports an exclusive lower endpoint", () =>
    checkRange(
      "price",
      [{ value: 3, inclusive: false }, 9],
      [3, 5, 9],
      [2, 3],
    ));
  it("supports two exclusive endpoints", () =>
    checkRange(
      "price",
      [
        { value: 3, inclusive: false },
        { value: 9, inclusive: false },
      ],
      [3, 5, 9],
      [2],
    ));
  it("matches a singleton only when both endpoints are inclusive", () =>
    checkRange("price", [3, 3], [2, 3, 4], [2]));
  it("matches nothing for equal endpoints with either boundary excluded", () =>
    checkRange("price", [3, { value: 3, inclusive: false }], [2, 3, 4], []));
  it("matches nothing for reversed bounds", () =>
    checkRange("price", [9, 3], [2, 3, 5, 9, 10], []));
  it("does not coerce text, booleans, null, missing values, or lists to numbers", () =>
    checkRange(
      "price",
      [0, 9],
      [false, true, "5", null, undefined, [5, 7], 5],
      [7],
    ));
  it("supports fractional and negative numeric endpoints", () =>
    checkRange("price", [-1.5, 2.5], [-2, -1.5, 0, 2.5, 3], [2, 3, 4]));
  it("compares ISO dates chronologically", () =>
    checkRange(
      "dueDate",
      ["2026-01-01", { value: "2026-02-01", inclusive: false }],
      ["2025-12-31", "2026-01-01", "2026-01-15", "2026-02-01", null],
      [2, 3],
    ));
  it("compares canonical UTC timestamps at millisecond precision", () =>
    checkRange(
      "completedAt",
      ["2026-01-01T00:00:00.001Z", "2026-01-01T00:00:00.002Z"],
      [
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.001Z",
        "2026-01-01T00:00:00.002Z",
        "2026-01-01T00:00:00.003Z",
      ],
      [2, 3],
    ));
  it("matches weekly periods at both bounds and excludes surrounding weeks", () =>
    checkRange(
      "weekPeriod",
      ["2026-W32", "2026-W37"],
      [
        "2026-W31",
        "2026-W32",
        "2026-W35",
        "2026-W37",
        "2026-W38",
        null,
        undefined,
      ],
      [2, 3, 4],
      periodSchema,
    ));
  it("compares week labels across year boundaries", () =>
    checkRange(
      "weekPeriod",
      ["2025-W52", { value: "2026-W02", inclusive: false }],
      ["2025-W51", "2025-W52", "2026-W01", "2026-W02"],
      [2, 3],
      periodSchema,
    ));
  it("compares month labels without converting to dates", () =>
    checkRange(
      "monthPeriod",
      ["2025-12", "2026-02"],
      ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03"],
      [2, 3, 4],
      periodSchema,
    ));
  it("compares quarter labels across years", () =>
    checkRange(
      "quarterPeriod",
      ["2025-Q4", "2026-Q1"],
      ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"],
      [2, 3],
      periodSchema,
    ));
  it("compares year strings without coercing numbers or booleans", () =>
    checkRange(
      "yearPeriod",
      ["2024", "2026"],
      ["2023", "2024", "2025", "2026", "2027", 2025, true],
      [2, 3, 4],
      periodSchema,
    ));
  it("defaults period fields to day format", () =>
    checkRange(
      "dayPeriod",
      ["2026-04-01", "2026-04-05"],
      ["2026-03-31", "2026-04-01", "2026-04-05", "2026-04-06"],
      [2, 3],
      periodSchema,
    ));
  it("rejects period endpoints of the wrong field format", () =>
    checkInvalidField(
      FiltersSchema.parse({
        weekPeriod: { op: "range", value: ["2026-01", "2026-09"] },
      }),
      periodSchema,
    ));
  it("rejects numeric endpoints for year period fields", () =>
    checkInvalidField(
      { yearPeriod: { op: "range", value: [2024, 2026] } },
      periodSchema,
    ));
  it("rejects week endpoints for datetime fields", () =>
    checkInvalidField(
      FiltersSchema.parse({
        completedAt: { op: "range", value: ["2026-W32", "2026-W37"] },
      }),
    ));
  it("rejects week endpoints for plaintext fields", () =>
    checkInvalidField(
      FiltersSchema.parse({
        title: { op: "range", value: ["2026-W32", "2026-W37"] },
      }),
    ));
  it("rejects range on ordinary text fields", () =>
    checkInvalidField(
      FiltersSchema.parse({
        title: { op: "range", value: ["2026-01-01", "2026-12-31"] },
      }),
    ));
  it("rejects numeric endpoints on a date field", () =>
    checkInvalidField({ dueDate: { op: "range", value: [3, 9] } }));
  it("rejects range on multi-value fields", () =>
    checkInvalidField({ aliases: { op: "range", value: [3, 9] } }));
  it("rejects range on relation fields", () =>
    checkInvalidField({ project: { op: "range", value: [3, 9] } }));
});

describe("filter-entities", () => {
  describe("matchesFilter", () => {
    const check = (
      filter: Parameters<typeof matchesFilter>[0],
      value: Parameters<typeof matchesFilter>[1],
      expected: boolean,
    ) => {
      expect(matchesFilter(filter, value)).toBe(expected);
    };

    describe("simple filter (equality)", () => {
      it("matches equal string", () => check("relation", "relation", true));

      it("does not match different string", () =>
        check("relation", "plaintext", false));

      it("matches equal number", () => check(42, 42, true));

      it("matches equal boolean", () => check(true, true, true));

      it("matches null filter with null value", () =>
        check(null as never, null, true));
    });

    describe("eq operator", () => {
      it("matches equal value", () =>
        check({ op: "eq", value: "relation" }, "relation", true));

      it("does not match different value", () =>
        check({ op: "eq", value: "relation" }, "plaintext", false));
    });

    describe("not operator", () => {
      it("matches different value", () =>
        check({ op: "not", value: "relation" }, "plaintext", true));

      it("does not match equal value", () =>
        check({ op: "not", value: "relation" }, "relation", false));
    });

    describe("in operator", () => {
      it("matches value in array", () =>
        check({ op: "in", value: ["a", "b", "c"] }, "b", true));

      it("does not match value not in array", () =>
        check({ op: "in", value: ["a", "b", "c"] }, "d", false));

      it("works with numbers", () =>
        check({ op: "in", value: [1, 2, 3] }, 2, true));

      it("is normalized from plain array", () =>
        check(["a", "b", "c"], "b", true));
    });

    describe("notIn operator", () => {
      it("matches value not in array", () =>
        check({ op: "notIn", value: ["a", "b", "c"] }, "d", true));

      it("does not match value in array", () =>
        check({ op: "notIn", value: ["a", "b", "c"] }, "b", false));
    });

    describe("contains operator", () => {
      it("matches substring", () =>
        check({ op: "contains", value: "hello" }, "say hello world", true));

      it("does not match missing substring", () =>
        check({ op: "contains", value: "goodbye" }, "hello world", false));
    });

    describe("notContains operator", () => {
      it("matches missing substring", () =>
        check({ op: "notContains", value: "goodbye" }, "hello world", true));

      it("does not match present substring", () =>
        check({ op: "notContains", value: "hello" }, "hello world", false));
    });

    describe("comparison operators", () => {
      it("lt matches lesser value", () => {
        check({ op: "lt", value: 10 }, 5, true);
        check({ op: "lt", value: 10 }, 10, false);
      });

      it("lte matches lesser or equal value", () => {
        check({ op: "lte", value: 10 }, 10, true);
        check({ op: "lte", value: 10 }, 11, false);
      });

      it("gt matches greater value", () => {
        check({ op: "gt", value: 10 }, 15, true);
        check({ op: "gt", value: 10 }, 10, false);
      });

      it("gte matches greater or equal value", () => {
        check({ op: "gte", value: 10 }, 10, true);
        check({ op: "gte", value: 10 }, 9, false);
      });
    });

    describe("empty operator", () => {
      it("matches null when checking for empty", () =>
        check({ op: "empty", value: true }, null, true));

      it("matches empty string when checking for empty", () =>
        check({ op: "empty", value: true }, "", true));

      it("does not match non-empty value when checking for empty", () =>
        check({ op: "empty", value: true }, "hello", false));

      it("matches non-empty value when checking for not empty", () =>
        check({ op: "empty", value: false }, "hello", true));

      it("matches empty array when checking for empty", () =>
        check({ op: "empty", value: true }, [], true));

      it("does not match non-empty array when checking for empty", () =>
        check({ op: "empty", value: true }, ["a"], false));

      it("matches non-empty array when checking for not empty", () =>
        check({ op: "empty", value: false }, ["a"], true));

      it("does not match empty array when checking for not empty", () =>
        check({ op: "empty", value: false }, [], false));
    });
  });

  describe("matchesFilters", () => {
    const check = (
      filters: Parameters<typeof matchesFilters>[0],
      record: Parameters<typeof matchesFilters>[1],
      expected: boolean,
    ) => {
      expect(matchesFilters(filters, record)).toBe(expected);
    };

    it("matches when all filters pass", () =>
      check(
        { dataType: "relation", status: "active" },
        { dataType: "relation", status: "active", name: "test" },
        true,
      ));

    it("does not match when one filter fails", () =>
      check(
        { dataType: "relation", status: "active" },
        { dataType: "relation", status: "inactive" },
        false,
      ));

    it("matches empty filters", () =>
      check({}, { dataType: "relation" }, true));

    it("works with complex filters", () =>
      check(
        { dataType: { op: "in", value: ["relation", "plaintext"] } },
        { dataType: "relation" },
        true,
      ));

    it("works with array shorthand filters", () =>
      check(
        { dataType: ["relation", "plaintext"] },
        { dataType: "relation" },
        true,
      ));

    describe("$text filter", () => {
      const checkText = (
        filters: Parameters<typeof matchesFilters>[0],
        record: Parameters<typeof matchesFilters>[1],
        expected: boolean,
      ) => {
        expect(matchesFilters(filters, record, mockRecordSchema)).toBe(
          expected,
        );
      };

      it("matches when text appears in a field value", () =>
        checkText(
          { $text: "hello" },
          { key: "my-record", title: "say hello world" },
          true,
        ));

      it("does not match when text is absent from all fields", () =>
        checkText(
          { $text: "goodbye" },
          { key: "my-record", title: "hello world" },
          false,
        ));

      it("is case-insensitive", () =>
        checkText(
          { $text: "HELLO" },
          { key: "my-record", title: "hello world" },
          true,
        ));

      it("matches against key field", () =>
        checkText(
          { $text: "my-record" },
          { key: "my-record", title: "some title" },
          true,
        ));

      it("matches against description field", () =>
        checkText(
          { $text: "details" },
          { key: "rec", title: "Title", description: "some details here" },
          true,
        ));

      it("matches against name field", () =>
        checkText(
          { $text: "Rick" },
          { key: "user-1", name: "Rick Sanchez" },
          true,
        ));

      it("combines with regular filters using AND", () =>
        checkText(
          { $text: "hello", status: "active" },
          { key: "rec", title: "hello world", status: "active" },
          true,
        ));

      it("fails when text matches but regular filter does not", () =>
        checkText(
          { $text: "hello", status: "active" },
          { key: "rec", title: "hello world", status: "inactive" },
          false,
        ));

      it("is skipped when no schema is provided", () =>
        check(
          { $text: "nonexistent" },
          { key: "my-record", title: "hello world" },
          true,
        ));
    });
  });

  describe("getSearchableFields", () => {
    it("includes plaintext and richtext fields", () => {
      const fields = getSearchableFields(mockRecordSchema);
      const keys = fields.map((f) => f.key);
      expect(keys).toContain("key" as any);
      expect(keys).toContain("title" as any);
      expect(keys).toContain("description" as any);
    });

    it("excludes tags", () => {
      const fields = getSearchableFields(mockRecordSchema);
      const keys = fields.map((f) => f.key);
      expect(keys).not.toContain("tags");
    });

    it("includes multi-value text fields that are not excluded", () => {
      const fields = getSearchableFields(mockRecordSchema);
      const keys = fields.map((f) => f.key);
      // mockRecordSchema includes aliases (plaintext, allowMultiple)
      expect(keys).toContain("aliases" as any);
    });

    it("excludes identity fields", () => {
      const fields = getSearchableFields(mockRecordSchema);
      const keys = fields.map((f) => f.key);
      expect(keys).not.toContain("id");
      expect(keys).not.toContain("uid");
      expect(keys).not.toContain("type");
    });

    it("excludes non-text fields", () => {
      const fields = getSearchableFields(mockRecordSchema);
      const keys = fields.map((f) => f.key);
      expect(keys).not.toContain("priority");
    });
  });
});
