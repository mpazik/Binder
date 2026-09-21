import { describe, it, expect } from "bun:test";
import { z } from "zod";
import type { FieldsetNested } from "./field.ts";
import {
  type Includes,
  FiltersSchema,
  QueryParamsSchema,
  RangeFilterSchema,
  type QueryParams,
  type RangeFilter,
  includesWithUid,
  mergeIncludes,
  pickByIncludes,
} from "./query.ts";

describe("structured range schema", () => {
  const accepts = (value: unknown): boolean =>
    RangeFilterSchema.safeParse({ op: "range", value }).success;

  it("accepts scalar shorthand and explicit endpoints through query schemas", () => {
    const query: QueryParams = {
      filters: {
        score: { op: "range", value: [3, { value: 9, inclusive: false }] },
      },
    };
    expect(QueryParamsSchema.parse(query)).toEqual(query);
  });
  it("accepts two explicit endpoints", () => {
    expect(
      accepts([
        { value: 3, inclusive: false },
        { value: 9, inclusive: true },
      ]),
    ).toBe(true);
  });
  it("accepts ISO dates", () => {
    expect(accepts(["2026-01-01", "2026-12-31"])).toBe(true);
  });
  it("accepts canonical UTC timestamps", () => {
    expect(
      accepts(["2026-01-01T00:00:00.000Z", "2026-12-31T23:59:59.999Z"]),
    ).toBe(true);
  });
  it("accepts week periods across a year boundary", () => {
    expect(accepts(["2025-W52", "2026-W02"])).toBe(true);
  });
  it("accepts month periods", () => {
    expect(accepts(["2026-01", "2026-09"])).toBe(true);
  });
  it("accepts quarter periods", () => {
    expect(accepts(["2025-Q4", "2026-Q2"])).toBe(true);
  });
  it("accepts year periods as strings", () => {
    expect(accepts(["2024", "2026"])).toBe(true);
  });
  it("rejects mixed period granularities", () => {
    expect(accepts(["2026-W01", "2026-09"])).toBe(false);
  });
  it("rejects out-of-format period labels", () => {
    expect([
      accepts(["2026-W00", "2026-W54"]),
      accepts(["2026-00", "2026-13"]),
      accepts(["2026-Q0", "2026-Q5"]),
    ]).toEqual([false, false, false]);
  });
  it("rejects arbitrary text", () => {
    expect(accepts(["a", "z"])).toBe(false);
  });
  it("requires exactly two endpoints", () => {
    expect([accepts([]), accepts([3]), accepts([3, 9, 12])]).toEqual([
      false,
      false,
      false,
    ]);
  });
  it("rejects mixed endpoint categories", () => {
    expect([
      accepts([3, "2026-01-01"]),
      accepts(["2026-01-01", "2026-01-01T00:00:00.000Z"]),
    ]).toEqual([false, false]);
  });
  it("requires both explicit endpoint properties and rejects extras", () => {
    expect([
      accepts([{ value: 3 }, 9]),
      accepts([{ inclusive: true }, 9]),
      accepts([{ value: 3, inclusive: true, extra: 1 }, 9]),
    ]).toEqual([false, false, false]);
  });
  it("rejects null, boolean, and non-finite endpoints", () => {
    expect([
      accepts([null, 9]),
      accepts([true, false]),
      accepts([3, Infinity]),
      accepts([NaN, 9]),
    ]).toEqual([false, false, false, false]);
  });
  it("rejects impossible calendar dates and noncanonical timestamps", () => {
    expect([
      accepts(["2026-02-30", "2026-03-01"]),
      accepts(["2026-01-01T00:00:00+02:00", "2026-01-02T00:00:00+02:00"]),
    ]).toEqual([false, false]);
  });
  it("accepts reversed endpoints without swapping them", () => {
    expect(RangeFilterSchema.parse({ op: "range", value: [9, 3] })).toEqual({
      op: "range",
      value: [9, 3],
    });
  });
  it("keeps endpoint objects exclusive to range", () => {
    expect(
      FiltersSchema.safeParse({
        score: { op: "in", value: [3, { value: 9, inclusive: false }] },
      }).success,
    ).toBe(false);
  });
  it("rejects parameters outside value", () => {
    expect(
      RangeFilterSchema.safeParse({
        op: "range",
        value: [3, 9],
        inclusive: false,
      }).success,
    ).toBe(false);
  });
  it("retains ordinary comparison filters", () => {
    expect(FiltersSchema.parse({ score: { op: "gte", value: 3 } })).toEqual({
      score: { op: "gte", value: 3 },
    });
  });
  it("supports JSON Schema generation without opaque transforms", () => {
    expect(z.toJSONSchema(RangeFilterSchema).type).toBe("object");
  });
  it("requires branded dates in TypeScript, not raw strings", () => {
    const filter: RangeFilter = {
      op: "range",
      // @ts-expect-error Unvalidated strings are not branded date endpoints.
      value: ["2026-01-01", "2026-12-31"],
    };
    expect(RangeFilterSchema.safeParse(filter).success).toBe(true);
  });
});

describe("query", () => {
  describe("includesWithUid", () => {
    const check = (input: Includes, expected: Includes) => {
      expect(includesWithUid(input)).toEqual(expected);
    };

    it("adds uid to top level", () =>
      check({ title: true }, { uid: true, title: true }));

    it("adds uid to nested includes", () =>
      check(
        { tasks: { title: true } },
        { uid: true, tasks: { uid: true, title: true } },
      ));

    it("adds uid to deeply nested includes", () =>
      check(
        { tasks: { title: true, assignee: { name: true } } },
        {
          uid: true,
          tasks: {
            uid: true,
            title: true,
            assignee: { uid: true, name: true },
          },
        },
      ));

    it("handles nested includes with filters", () =>
      check(
        { tasks: { includes: { title: true }, filters: { status: "active" } } },
        {
          uid: true,
          tasks: {
            includes: { uid: true, title: true },
            filters: { status: "active" },
          },
        },
      ));

    it("keeps filters-only query as reference-only include", () =>
      check(
        { tasks: { filters: { status: "active" } } },
        {
          uid: true,
          tasks: { filters: { status: "active" } },
        },
      ));
  });

  describe("mergeIncludes", () => {
    const check = (
      a: Includes | undefined,
      b: Includes | undefined,
      expected: Includes | undefined,
    ) => {
      expect(mergeIncludes(a, b)).toEqual(expected);
    };

    it("returns undefined when both are undefined", () =>
      check(undefined, undefined, undefined));

    it("returns a when b is undefined", () =>
      check({ title: true }, undefined, { title: true }));

    it("returns b when a is undefined", () =>
      check(undefined, { title: true }, { title: true }));

    it("merges non-overlapping keys", () =>
      check({ title: true }, { status: true }, { title: true, status: true }));

    it("merges nested objects recursively", () =>
      check(
        { parent: { weekPeriod: true } },
        { parent: { plan: true } },
        { parent: { weekPeriod: true, plan: true } },
      ));

    it("injects key and uid when merging object with true", () =>
      check(
        { parent: { weekPeriod: true, plan: true } },
        { parent: true },
        { parent: { key: true, uid: true, weekPeriod: true, plan: true } },
      ));

    it("injects key and uid when merging true with object", () =>
      check(
        { parent: true },
        { parent: { weekPeriod: true, plan: true } },
        { parent: { key: true, uid: true, weekPeriod: true, plan: true } },
      ));

    it("overwrites boolean with boolean", () =>
      check({ title: false }, { title: true }, { title: true }));

    it("injects key and uid into query includes when merging query with true", () =>
      check(
        { relatesTo: { filters: { type: "Concept" } } },
        { relatesTo: true },
        {
          relatesTo: {
            includes: { key: true, uid: true },
            filters: { type: "Concept" },
          },
        },
      ));

    it("injects key and uid into query includes when merging true with query", () =>
      check(
        { relatesTo: true },
        { relatesTo: { filters: { type: "Concept" } } },
        {
          relatesTo: {
            includes: { key: true, uid: true },
            filters: { type: "Concept" },
          },
        },
      ));

    it("preserves existing query includes when merging with true", () =>
      check(
        {
          relatesTo: {
            includes: { title: true },
            filters: { type: "Concept" },
          },
        },
        { relatesTo: true },
        {
          relatesTo: {
            includes: { key: true, uid: true, title: true },
            filters: { type: "Concept" },
          },
        },
      ));

    it("merges query with plain includes", () =>
      check(
        { relatesTo: { filters: { type: "Concept" } } },
        { relatesTo: { title: true } },
        {
          relatesTo: {
            includes: { title: true },
            filters: { type: "Concept" },
          },
        },
      ));

    it("merges plain includes with query", () =>
      check(
        { relatesTo: { title: true } },
        {
          relatesTo: {
            includes: { status: true },
            filters: { type: "Concept" },
          },
        },
        {
          relatesTo: {
            includes: { title: true, status: true },
            filters: { type: "Concept" },
          },
        },
      ));

    it("merges two queries, b filters win per key", () =>
      check(
        {
          relatesTo: {
            includes: { title: true },
            filters: { type: "Concept", status: "draft" },
          },
        },
        {
          relatesTo: {
            includes: { status: true },
            filters: { status: "active" },
          },
        },
        {
          relatesTo: {
            includes: { title: true, status: true },
            filters: { type: "Concept", status: "active" },
          },
        },
      ));

    it("collapses to plain includes when no filters remain", () =>
      check(
        { relatesTo: { includes: { title: true } } },
        { relatesTo: { status: true } },
        { relatesTo: { title: true, status: true } },
      ));
  });

  describe("pickByIncludes", () => {
    const check = (
      entity: FieldsetNested,
      includes: Includes,
      expected: FieldsetNested,
    ) => {
      expect(pickByIncludes(entity, includes)).toEqual(expected);
    };

    it("picks scalar fields", () =>
      check(
        { title: "My Task", status: "active", priority: "high" },
        { title: true, status: true },
        { title: "My Task", status: "active" },
      ));

    it("collapses relation object to key", () =>
      check(
        {
          title: "Day Entry",
          parent: { key: "jw-2026-W07", uid: "abc", weekPeriod: "2026-W07" },
        },
        { title: true, parent: true },
        { title: "Day Entry", parent: "jw-2026-W07" },
      ));

    it("collapses relation object to uid when no key", () =>
      check(
        { title: "Day Entry", parent: { uid: "abc", weekPeriod: "2026-W07" } },
        { title: true, parent: true },
        { title: "Day Entry", parent: "abc" },
      ));

    it("picks nested fields from relation object", () =>
      check(
        {
          parent: {
            key: "jw-2026-W07",
            uid: "abc",
            weekPeriod: "2026-W07",
            plan: "Do stuff",
          },
        },
        { parent: { weekPeriod: true } },
        { parent: { weekPeriod: "2026-W07" } },
      ));

    it("collapses array of relation objects to keys", () =>
      check(
        {
          tasks: [
            { key: "task-1", uid: "u1", title: "First" },
            { key: "task-2", uid: "u2", title: "Second" },
          ],
        },
        { tasks: true },
        { tasks: ["task-1", "task-2"] },
      ));

    it("picks nested fields from array of relation objects", () =>
      check(
        {
          tasks: [
            { key: "task-1", uid: "u1", title: "First", status: "active" },
            { key: "task-2", uid: "u2", title: "Second", status: "done" },
          ],
        },
        { tasks: { title: true } },
        { tasks: [{ title: "First" }, { title: "Second" }] },
      ));

    it("skips null and undefined values", () =>
      check(
        { title: "My Task", description: null },
        { title: true, description: true },
        { title: "My Task" },
      ));

    it("skips fields with false includes", () =>
      check(
        { title: "My Task", status: "active" },
        { title: true, status: false },
        { title: "My Task" },
      ));

    it("handles deeply nested includes", () =>
      check(
        {
          parent: {
            key: "jw-2026-W07",
            uid: "abc",
            grandparent: {
              key: "jm-2026-02",
              uid: "def",
              monthPeriod: "2026-02",
            },
          },
        },
        { parent: { grandparent: { monthPeriod: true } } },
        { parent: { grandparent: { monthPeriod: "2026-02" } } },
      ));

    it("collapses deeply nested relation to key", () =>
      check(
        {
          parent: {
            key: "jw-2026-W07",
            uid: "abc",
            grandparent: {
              key: "jm-2026-02",
              uid: "def",
              monthPeriod: "2026-02",
            },
          },
        },
        { parent: { grandparent: true } },
        { parent: { grandparent: "jm-2026-02" } },
      ));

    it("keeps scalar values in arrays unchanged", () =>
      check(
        { tags: ["foo", "bar"] },
        { tags: true },
        { tags: ["foo", "bar"] },
      ));
  });
});
