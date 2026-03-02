import { describe, it, expect } from "bun:test";
import {
  formatDsvCell,
  escapeCsvCell,
  escapeTsvCell,
  serializeDsv,
} from "./dsv.ts";

type Item = Record<string, unknown>;

const checkCell = (value: unknown, expected: string) => {
  expect(formatDsvCell(value)).toBe(expected);
};

const checkCsv = (input: string, expected: string) => {
  expect(escapeCsvCell(input)).toBe(expected);
};

const checkTsv = (input: string, expected: string) => {
  expect(escapeTsvCell(input)).toBe(expected);
};

const checkSerialize = (
  items: Item[],
  delimiter: "," | "\t",
  expected: string,
) => {
  expect(serializeDsv(items, delimiter)).toBe(expected);
};

const checkSerializeLine = (
  items: Item[],
  delimiter: "," | "\t",
  lineIndex: number,
  expected: string,
) => {
  const result = serializeDsv(items, delimiter);
  expect(result.split("\n")[lineIndex]).toBe(expected);
};

describe("formatDsvCell", () => {
  describe("scalars", () => {
    it("empty for null/undefined", () => {
      checkCell(null, "");
      checkCell(undefined, "");
    });

    it("strings directly", () => {
      checkCell("hello", "hello");
      checkCell("", "");
    });

    it("numbers directly", () => {
      checkCell(42, "42");
      checkCell(0, "0");
      checkCell(3.14, "3.14");
    });

    it("booleans directly", () => {
      checkCell(true, "true");
      checkCell(false, "false");
    });
  });

  describe("arrays", () => {
    it("empty for empty array", () => {
      checkCell([], "");
    });

    it("joins scalars with comma-space", () => {
      checkCell(["a", "b", "c"], "a, b, c");
      checkCell([1, 2, 3], "1, 2, 3");
      checkCell([true, false], "true, false");
      checkCell(["a", 1, true], "a, 1, true");
    });

    it("preserves null/undefined in arrays", () => {
      checkCell(["a", null, "b"], "a, , b");
      checkCell([null], "");
    });

    it("JSON-stringifies arrays with objects", () => {
      checkCell([{ a: 1 }, { b: 2 }], JSON.stringify([{ a: 1 }, { b: 2 }]));
      checkCell(["a", { b: 2 }], JSON.stringify(["a", { b: 2 }]));
    });
  });

  describe("objects", () => {
    it("JSON-stringifies", () => {
      checkCell({ a: 1, b: "two" }, '{"a":1,"b":"two"}');
    });
  });
});

describe("escapeCsvCell", () => {
  it("simple values unchanged", () => {
    checkCsv("hello", "hello");
    checkCsv("42", "42");
    checkCsv("", "");
  });

  it("quotes commas", () => {
    checkCsv("a, b", '"a, b"');
  });

  it("quotes and doubles quotes", () => {
    checkCsv('say "hi"', '"say ""hi"""');
  });

  it("quotes newlines and carriage returns", () => {
    checkCsv("line1\nline2", '"line1\nline2"');
    checkCsv("line1\rline2", '"line1\rline2"');
  });

  it("quotes mixed special chars", () => {
    checkCsv('a,b"c\nd', '"a,b""c\nd"');
  });
});

describe("escapeTsvCell", () => {
  it("simple values unchanged", () => {
    checkTsv("hello", "hello");
    checkTsv("", "");
  });

  it("replaces tabs/newlines/CR with spaces", () => {
    checkTsv("a\tb", "a b");
    checkTsv("a\nb", "a b");
    checkTsv("a\rb", "a b");
    checkTsv("a\tb\nc\rd", "a b c d");
  });

  it("preserves commas and quotes", () => {
    checkTsv('a,b"c', 'a,b"c');
  });
});

describe("serializeDsv", () => {
  it("empty for empty items", () => {
    checkSerialize([], ",", "");
  });

  describe("CSV", () => {
    it("header and data rows", () => {
      checkSerialize(
        [
          { name: "Alice", age: 30 },
          { name: "Bob", age: 25 },
        ],
        ",",
        "name,age\nAlice,30\nBob,25",
      );
    });

    it("collects all headers and fills missing", () => {
      const items = [
        { a: 1, b: 2 },
        { b: 3, c: 4 },
      ];
      checkSerializeLine(items, ",", 0, "a,b,c");
      checkSerializeLine(items, ",", 1, "1,2,");
      checkSerializeLine(items, ",", 2, ",3,4");
    });

    it("quotes cells with commas", () => {
      checkSerializeLine([{ tags: ["a", "b"] }], ",", 1, '"a, b"');
    });

    it("escapes JSON objects", () => {
      checkSerializeLine([{ meta: { x: 1 } }], ",", 1, '"{""x"":1}"');
    });
  });

  describe("TSV", () => {
    it("tab-separated columns", () => {
      const items = [{ name: "Alice", age: 30 }];
      checkSerializeLine(items, "\t", 0, "name\tage");
      checkSerializeLine(items, "\t", 1, "Alice\t30");
    });

    it("replaces tabs with spaces", () => {
      checkSerializeLine([{ text: "a\tb" }], "\t", 1, "a b");
    });

    it("fills missing fields", () => {
      const items = [{ a: 1 }, { b: 2 }];
      checkSerializeLine(items, "\t", 0, "a\tb");
      checkSerializeLine(items, "\t", 1, "1\t");
      checkSerializeLine(items, "\t", 2, "\t2");
    });
  });
});
