import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { throwIfError } from "@binder/utils";
import "@binder/utils/tests";
import {
  detectContentFormat,
  parseContent,
  parseContentToArray,
  type InputFormat,
} from "./parse.ts";

describe("input-parser", () => {
  describe("detectContentFormat", () => {
    const check = (content: string, expected: InputFormat) => {
      expect(detectContentFormat(content)).toBe(expected);
    };

    it("detects json object", () => check('{"key": "value"}', "json"));
    it("detects json array", () => check('[{"key": "value"}]', "json"));
    it("detects jsonl with multiple lines", () =>
      check('{"a": 1}\n{"b": 2}', "jsonl"));
    it("detects yaml when content does not start with { or [", () =>
      check("key: value\nother: thing", "yaml"));
    it("falls back to yaml for invalid json starting with {", () =>
      check("{key: value}", "yaml"));
    it("handles whitespace before json", () =>
      check('  {"key": "value"}', "json"));
    it("handles whitespace before yaml", () => check("  key: value", "yaml"));
  });

  describe("parseContentToArray", () => {
    const check = (
      content: string,
      expected: unknown[],
      format?: InputFormat,
    ) => {
      const result = throwIfError(parseContentToArray(content, format));
      expect(result).toEqual(expected);
    };

    it("parses json array", () =>
      check('[{"a": 1}, {"b": 2}]', [{ a: 1 }, { b: 2 }], "json"));
    it("wraps single json object in array", () =>
      check('{"a": 1}', [{ a: 1 }], "json"));
    it("parses jsonl content", () =>
      check('{"a": 1}\n{"b": 2}', [{ a: 1 }, { b: 2 }], "jsonl"));
    it("skips empty lines in jsonl", () =>
      check('{"a": 1}\n\n{"b": 2}\n', [{ a: 1 }, { b: 2 }], "jsonl"));
    it("parses yaml array", () =>
      check("- a: 1\n- b: 2", [{ a: 1 }, { b: 2 }], "yaml"));
    it("auto-detects json format", () =>
      check('{"key": "value"}', [{ key: "value" }]));
    it("auto-detects yaml format", () =>
      check("key: value", [{ key: "value" }]));
    it("auto-detects jsonl format", () =>
      check('{"a": 1}\n{"b": 2}', [{ a: 1 }, { b: 2 }]));
  });

  describe("yaml scalar text", () => {
    const check = (content: string, expected: unknown) =>
      expect(throwIfError(parseContentToArray(`- ${content}`, "yaml"))).toEqual(
        [expected],
      );

    it("keeps a number that prints as written", () =>
      check("{ a: 2026 }", { a: 2026 }));
    it("keeps a leading-zero number as written", () =>
      check("{ a: 007 }", { a: "007" }));
    it("keeps a trailing-zero decimal as written", () =>
      check("{ a: 1.10 }", { a: "1.10" }));
    it("keeps a hexadecimal number as written", () =>
      check("{ a: 0x1F }", { a: "0x1F" }));
    it("keeps an exponent number as written", () =>
      check("{ a: 1e3 }", { a: "1e3" }));
    it("keeps a signed number as written", () =>
      check("{ a: +5 }", { a: "+5" }));
    it("keeps a capitalized boolean as written", () =>
      check("{ a: True }", { a: "True" }));
    it("keeps a boolean that prints as written", () =>
      check("{ a: true }", { a: true }));
    it("keeps null", () => check("{ a: ~ }", { a: null }));
    it("keeps the text of list items", () =>
      check("{ a: [007, 5] }", { a: ["007", 5] }));
    it("keeps quoted text", () => check('{ a: "007" }', { a: "007" }));
  });

  describe("parseContent", () => {
    const itemSchema = z.object({ id: z.number() });

    const check = (
      content: string,
      expected: { id: number }[],
      format?: InputFormat,
      mapItem?: (item: unknown) => unknown,
    ) => {
      const result = throwIfError(
        parseContent(content, itemSchema, format, mapItem),
      );
      expect(result).toEqual(expected);
    };

    const checkError = (content: string, format?: InputFormat) => {
      expect(parseContent(content, itemSchema, format)).toBeErr();
    };

    it("parses and validates json array items", () =>
      check('[{"id": 1}, {"id": 2}]', [{ id: 1 }, { id: 2 }]));
    it("parses and validates single json object as array", () =>
      check('{"id": 1}', [{ id: 1 }]));
    it("parses and validates yaml content", () =>
      check("- id: 1\n- id: 2", [{ id: 1 }, { id: 2 }]));
    it("parses and validates jsonl items", () =>
      check('{"id": 1}\n{"id": 2}', [{ id: 1 }, { id: 2 }]));
    it("returns error if any item is invalid", () =>
      checkError('[{"id": 1}, {"id": "invalid"}]'));
    it("returns error for invalid json", () =>
      checkError("{invalid json}", "json"));

    it("applies mapItem before validation", () => {
      const mapItem = (raw: unknown) => ({
        id: (raw as Record<string, unknown>).value,
      });
      check(
        '[{"value": 1}, {"value": 2}]',
        [{ id: 1 }, { id: 2 }],
        undefined,
        mapItem,
      );
    });
  });
});
