import { describe, expect, it } from "bun:test";
import type { FieldValue } from "./field.ts";
import type { FieldDef } from "./schema.ts";
import type { Filters } from "./query.ts";
import {
  coerceFieldset,
  coerceFieldValue,
  coerceFilters,
} from "./value-coercion.ts";

const fieldOf = (dataType: string, extra: Partial<FieldDef> = {}): FieldDef =>
  ({ key: dataType, name: dataType, dataType, ...extra }) as FieldDef;

const schema = {
  fields: {
    yearPeriod: fieldOf("period", { periodFormat: "year" }),
    code: fieldOf("plaintext"),
    count: fieldOf("integer"),
    price: fieldOf("decimal"),
    done: fieldOf("boolean"),
    project: fieldOf("relation"),
    labels: fieldOf("plaintext", { allowMultiple: true }),
    meta: fieldOf("object"),
  },
};

describe("value-coercion", () => {
  describe("coerceFieldValue", () => {
    const check = (fieldKey: string, value: FieldValue, expected: FieldValue) =>
      expect(
        coerceFieldValue(
          schema.fields[fieldKey as keyof typeof schema.fields],
          value,
        ),
      ).toEqual(expected);

    describe("text fields", () => {
      it("reads a number as its text", () => check("yearPeriod", 2026, "2026"));
      it("reads a boolean as its text", () => check("code", true, "true"));
      it("Text for a text field stays unchanged", () =>
        check("code", "2026", "2026"));
      it("Null for a text field stays null", () => check("code", null, null));
      it("reads each number of a list as text", () =>
        check("labels", [2026, "a", 7], ["2026", "a", "7"]));
      it("reads a number reference as text", () => check("project", 5, "5"));
      it("Number reference in a relation tuple becomes text and the attributes stay", () =>
        check("project", [5, { role: "lead" }], ["5", { role: "lead" }]));
    });

    describe("number fields", () => {
      it("reads integer text as a number", () => check("count", "42", 42));
      it("reads negative integer text", () => check("count", "-3", -3));
      it("reads hexadecimal text kept by the YAML parse", () =>
        check("count", "0x1F", 31));
      it("reads leading-zero text", () => check("count", "007", 7));
      it("keeps fractional text for an integer field", () =>
        check("count", "1.5", "1.5"));
      it("keeps non-numeric text", () => check("count", "12abc", "12abc"));
      it("keeps empty text", () => check("count", "", ""));
      it("reads decimal text as a number", () => check("price", "1.10", 1.1));
      it("Number for a decimal field stays unchanged", () =>
        check("price", 1.1, 1.1));
    });

    describe("boolean fields", () => {
      it("reads true text", () => check("done", "true", true));
      it("reads false text in any case", () => check("done", "False", false));
      it("Word other than true or false stays text in a boolean field", () =>
        check("done", "yes", "yes"));
    });

    it("Object value in an object field stays unchanged", () =>
      check("meta", { a: 1 }, { a: 1 }));
  });

  describe("coerceFieldset", () => {
    it("Fieldset with a number for a text field and numeric text for an integer field reads each by its field, and unknown fields stay unchanged", () =>
      expect(
        coerceFieldset(
          { yearPeriod: 2026, count: "3", unknown: 5 } as Record<
            string,
            FieldValue
          >,
          schema,
        ),
      ).toEqual({ yearPeriod: "2026", count: 3, unknown: 5 }));
  });

  describe("coerceFilters", () => {
    const check = (filters: Filters, expected: Filters) =>
      expect(coerceFilters(filters, schema)).toEqual(expected);

    it("Filters with a number for a period field and numeric text for an integer field read each by its field", () =>
      check(
        { yearPeriod: 2026, count: "3" },
        { yearPeriod: "2026", count: 3 },
      ));

    it("reads the values of an in filter", () =>
      check(
        { yearPeriod: { op: "in", value: [2025, 2026] } },
        { yearPeriod: { op: "in", value: ["2025", "2026"] } },
      ));

    it("Number operand of a contains filter on a text field becomes text", () =>
      check(
        { code: { op: "contains", value: 12 } },
        { code: { op: "contains", value: "12" } },
      ));

    it("keeps text operator values on number fields", () =>
      check(
        { count: { op: "contains", value: "12" } },
        { count: { op: "contains", value: "12" } },
      ));

    it("reads range endpoints, inclusive or not", () =>
      check(
        {
          yearPeriod: {
            op: "range",
            value: [2025, { value: 2027, inclusive: false }],
          },
        } as unknown as Filters,
        {
          yearPeriod: {
            op: "range",
            value: ["2025", { value: "2027", inclusive: false }],
          },
        } as unknown as Filters,
      ));

    it("keeps relation values, where a number is an entity id", () =>
      check({ project: 5 }, { project: 5 }));

    it("keeps the empty operator value", () =>
      check(
        { code: { op: "empty", value: true } },
        { code: { op: "empty", value: true } },
      ));

    it("keeps filters on unknown fields and $text", () =>
      check({ $text: "a", other: 5 }, { $text: "a", other: 5 }));
  });
});
