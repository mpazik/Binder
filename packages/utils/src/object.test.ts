import { describe, expect, it } from "bun:test";
import {
  isObjTuple,
  isTuple,
  objTupleToTuple,
  tupleToObjTuple,
} from "./object.ts";

describe("object", () => {
  describe("isTuple", () => {
    const check = (input: unknown, expected: boolean) => {
      expect(isTuple(input)).toBe(expected);
    };

    it("matches two-element array with string key and object value", () => {
      check(["user-1", { role: "lead" }], true);
    });

    it("rejects array with primitive value", () => {
      check(["key", "value"], false);
    });

    it("rejects array with null value", () => {
      check(["key", null], false);
    });

    it("rejects array with array value", () => {
      check(["key", [1, 2]], false);
    });

    it("rejects single-element array", () => {
      check(["key"], false);
    });

    it("rejects three-element array", () => {
      check(["key", {}, "extra"], false);
    });

    it("rejects non-array", () => {
      check({ key: "value" }, false);
    });
  });

  describe("isObjTuple", () => {
    const check = (input: unknown, expected: boolean) => {
      expect(isObjTuple(input)).toBe(expected);
    };

    it("matches single-key object with object value", () => {
      check({ "user-1": { role: "lead" } }, true);
    });

    it("matches single-key object with empty object value", () => {
      check({ "task-2": {} }, true);
    });

    it("rejects single-key object with string value", () => {
      check({ uid: "_taskDef456" }, false);
    });

    it("rejects single-key object with number value", () => {
      check({ count: 5 }, false);
    });

    it("rejects single-key object with null value", () => {
      check({ key: null }, false);
    });

    it("rejects single-key object with array value", () => {
      check({ items: [1, 2] }, false);
    });

    it("rejects multi-key object", () => {
      check({ uid: "_abc", title: "Test" }, false);
    });

    it("rejects empty object", () => {
      check({}, false);
    });

    it("rejects primitives", () => {
      check("string", false);
      check(42, false);
      check(null, false);
      check(undefined, false);
    });
  });

  describe("objTupleToTuple", () => {
    it("converts single-key object to array tuple", () => {
      expect(objTupleToTuple({ "user-1": { role: "lead" } })).toEqual([
        "user-1",
        { role: "lead" },
      ]);
    });
  });

  describe("tupleToObjTuple", () => {
    it("converts array tuple to single-key object", () => {
      expect(tupleToObjTuple(["user-1", { role: "lead" }])).toEqual({
        "user-1": { role: "lead" },
      });
    });
  });
});
