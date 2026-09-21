import { describe, it, expect } from "bun:test";
import {
  throwIfError,
  type CalendarInterval,
  type IsoDate,
  type IsoTimestamp,
} from "@binder/utils";
import "@binder/utils/tests";
import type { Filters, Includes, IncludesQuery } from "./query.ts";
import {
  coerceFilterValue,
  parseSerialFilters,
  serializeFilters,
  parseSerialIncludes,
  serializeIncludes,
  parseSerialOrderBy,
  serializeOrderBy,
} from "./query-serial.ts";

describe("range serial intervals", () => {
  const check = (token: string, expected: Filters): void => {
    expect(throwIfError(parseSerialFilters([token]))).toEqual(expected);
    expect(serializeFilters(expected)).toEqual([token]);
  };

  it("round-trips inclusive endpoints", () =>
    check("score:range=[1,4]", { score: { op: "range", value: [1, 4] } }));
  it("round-trips an exclusive upper endpoint", () =>
    check("score:range=[1,4)", {
      score: { op: "range", value: [1, { value: 4, inclusive: false }] },
    }));
  it("round-trips an exclusive lower endpoint", () =>
    check("score:range=(1,4]", {
      score: { op: "range", value: [{ value: 1, inclusive: false }, 4] },
    }));
  it("round-trips two exclusive endpoints", () =>
    check("score:range=(1,4)", {
      score: {
        op: "range",
        value: [
          { value: 1, inclusive: false },
          { value: 4, inclusive: false },
        ],
      },
    }));
  it("serializes explicit inclusive endpoints canonically", () => {
    expect(
      serializeFilters({
        score: {
          op: "range",
          value: [
            { value: 1, inclusive: true },
            { value: 4, inclusive: true },
          ],
        },
      }),
    ).toEqual(["score:range=[1,4]"]);
  });
  it("round-trips fractional endpoints rendered with scientific notation", () =>
    check("score:range=[-1e-7,4.5]", {
      score: { op: "range", value: [-1e-7, 4.5] },
    }));
  it("round-trips dates", () =>
    check("dueDate:range=[2026-01-01,2026-02-01)", {
      dueDate: {
        op: "range",
        value: [
          "2026-01-01" as IsoDate,
          { value: "2026-02-01" as IsoDate, inclusive: false },
        ],
      },
    }));
  it("round-trips UTC timestamps", () =>
    check(
      "createdAt:range=[2026-01-01T00:00:00.000Z,2026-02-01T00:00:00.000Z]",
      {
        createdAt: {
          op: "range",
          value: [
            "2026-01-01T00:00:00.000Z" as IsoTimestamp,
            "2026-02-01T00:00:00.000Z" as IsoTimestamp,
          ],
        },
      },
    ));
  it("round-trips quoted year labels without numeric coercion", () =>
    check('yearPeriod:range=["2024","2026")', {
      yearPeriod: {
        op: "range",
        value: [
          "2024" as CalendarInterval,
          { value: "2026" as CalendarInterval, inclusive: false },
        ],
      },
    }));
  it("round-trips week labels", () =>
    check("weekPeriod:range=[2026-W32,2026-W37]", {
      weekPeriod: {
        op: "range",
        value: ["2026-W32" as CalendarInterval, "2026-W37" as CalendarInterval],
      },
    }));
  it("preserves reversed bounds rather than swapping them", () =>
    check("score:range=[4,1]", { score: { op: "range", value: [4, 1] } }));
  it("rejects unbounded intervals", () => {
    expect(parseSerialFilters(["score:range=[1,]"])).toBeErrWithKey(
      "invalid-range-filter",
    );
  });
  it("rejects missing interval delimiters", () => {
    expect(parseSerialFilters(["score:range=1,4"])).toBeErrWithKey(
      "invalid-range-filter",
    );
  });
  it("rejects arbitrary text endpoints", () => {
    expect(parseSerialFilters(["score:range=[a,z]"])).toBeErrWithKey(
      "invalid-range-filter",
    );
  });
  it("rejects endpoints from different categories", () => {
    expect(parseSerialFilters(["score:range=[1,2026-01-01]"])).toBeErrWithKey(
      "invalid-range-filter",
    );
  });
  it("rejects surplus endpoints", () => {
    expect(parseSerialFilters(["score:range=[1,4,7]"])).toBeErrWithKey(
      "invalid-range-filter",
    );
  });
  it("rejects invalid calendar dates", () => {
    expect(
      parseSerialFilters(["date:range=[2026-02-30,2026-03-01]"]),
    ).toBeErrWithKey("invalid-range-filter");
  });
  it("preserves intervals and sibling filters inside nested includes", () => {
    const serial =
      "project(tasks[score:range=[1,4),status=active](title)),tags";
    const expected: Includes = {
      project: {
        tasks: {
          filters: {
            score: { op: "range", value: [1, { value: 4, inclusive: false }] },
            status: "active",
          },
          includes: { title: true },
        },
      },
      tags: true,
    };
    expect(throwIfError(parseSerialIncludes(serial))).toEqual(expected);
    expect(serializeIncludes(expected)).toBe(serial);
  });
  it("distinguishes inclusive interval closure from include filter closure", () => {
    expect(
      throwIfError(parseSerialIncludes("tasks[score:range=(1,4]],title")),
    ).toEqual({
      tasks: {
        filters: {
          score: { op: "range", value: [{ value: 1, inclusive: false }, 4] },
        },
      },
      title: true,
    });
  });
  it("keeps two exclusive delimiters inside a filtered include", () => {
    expect(
      throwIfError(parseSerialIncludes("tasks[score:range=(1,4)]")),
    ).toEqual({
      tasks: {
        filters: {
          score: {
            op: "range",
            value: [
              { value: 1, inclusive: false },
              { value: 4, inclusive: false },
            ],
          },
        },
      },
    });
  });
  it("returns a validation error for invalid nested range endpoints", () => {
    expect(parseSerialIncludes("tasks[score:range=[1,nope]]")).toBeErrWithKey(
      "invalid-range-filter",
    );
  });
});

describe("query-serial", () => {
  describe("coerceFilterValue", () => {
    const check = (input: string, expected: string | number | boolean) => {
      expect(coerceFilterValue(input)).toBe(expected);
    };

    it("coerces 'true' to boolean", () => check("true", true));
    it("coerces 'false' to boolean", () => check("false", false));
    it("coerces integer string", () => check("42", 42));
    it("coerces negative integer", () => check("-7", -7));
    it("coerces float string", () => check("3.14", 3.14));
    it("coerces negative float", () => check("-1.5", -1.5));
    it("keeps plain string", () => check("hello", "hello"));
    it("keeps string with digits prefix", () => check("42abc", "42abc"));
  });

  describe("parseSerialFilters", () => {
    const check = (parts: string[], expected: Filters) => {
      expect(throwIfError(parseSerialFilters(parts))).toEqual(expected);
    };

    describe("simple equality", () => {
      it("parses single filter", () => check(["type=Task"], { type: "Task" }));

      it("parses multiple filters", () =>
        check(["type=Task", "status=done"], { type: "Task", status: "done" }));

      it("coerces boolean value", () =>
        check(["favorite=true"], { favorite: true }));

      it("coerces integer value", () => check(["priority=3"], { priority: 3 }));

      it("coerces float value", () => check(["score=9.5"], { score: 9.5 }));

      it("handles value containing equals sign", () =>
        check(["title=a=b"], { title: "a=b" }));

      it("keeps comparison operators inside equality values", () =>
        check(["title=Discuss score>=3"], { title: "Discuss score>=3" }));

      it("keeps named operators inside equality values", () =>
        check(["title=Discuss status:in=open,done"], {
          title: "Discuss status:in=open,done",
        }));
    });

    describe("symbolic operators", () => {
      it("parses not-equal", () =>
        check(["status!=done"], { status: { op: "not", value: "done" } }));

      it("parses greater-than", () =>
        check(["priority>3"], { priority: { op: "gt", value: 3 } }));

      it("parses greater-than-or-equal", () =>
        check(["priority>=3"], { priority: { op: "gte", value: 3 } }));

      it("parses less-than", () =>
        check(["score<100"], { score: { op: "lt", value: 100 } }));

      it("parses less-than-or-equal", () =>
        check(["score<=50"], { score: { op: "lte", value: 50 } }));
    });

    describe("named operators", () => {
      it("parses :in with comma-separated values", () =>
        check(["status:in=open,in-progress"], {
          status: { op: "in", value: ["open", "in-progress"] },
        }));

      it("parses :in with numeric values", () =>
        check(["priority:in=1,2,3"], {
          priority: { op: "in", value: [1, 2, 3] },
        }));

      it("parses :notIn", () =>
        check(["status:notIn=archived,deleted"], {
          status: { op: "notIn", value: ["archived", "deleted"] },
        }));

      it("parses :match", () =>
        check(["title:match=urgent"], {
          title: { op: "match", value: "urgent" },
        }));

      it("parses :contains", () =>
        check(["title:contains=test"], {
          title: { op: "contains", value: "test" },
        }));

      it("parses :notContains", () =>
        check(["title:notContains=draft"], {
          title: { op: "notContains", value: "draft" },
        }));

      it("keeps named operator text inside a contains value", () =>
        check(["title:contains=status:notContains=draft"], {
          title: { op: "contains", value: "status:notContains=draft" },
        }));

      it("parses :empty", () =>
        check(["assignee:empty"], {
          assignee: { op: "empty", value: true },
        }));

      it("parses :notEmpty", () =>
        check(["assignee:notEmpty"], {
          assignee: { op: "empty", value: false },
        }));
    });

    describe("plain text ($text)", () => {
      it("preserves explicit full-text equality", () =>
        check(["$text=urgent"], { $text: "urgent" }));

      it("does not accept arbitrary reserved or invalid field names", () =>
        check(["$other=urgent", "$textExtra=urgent", "123field=urgent"], {
          $text: "$other=urgent $textExtra=urgent 123field=urgent",
        }));

      it("collects plain text tokens", () =>
        check(["urgent", "bug"], { $text: "urgent bug" }));

      it("mixes plain text with filters", () =>
        check(["deployment", "issues", "type=Task"], {
          $text: "deployment issues",
          type: "Task",
        }));
    });

    describe("combined", () => {
      it("parses spec example 1", () =>
        check(["type=Task", "status=done", "priority>=3"], {
          type: "Task",
          status: "done",
          priority: { op: "gte", value: 3 },
        }));

      it("parses spec example 2", () =>
        check(
          [
            "status:in=open,in-progress",
            "title:match=urgent",
            "assignee:empty",
          ],
          {
            status: { op: "in", value: ["open", "in-progress"] },
            title: { op: "match", value: "urgent" },
            assignee: { op: "empty", value: true },
          },
        ));
    });

    describe("duplicate field merging", () => {
      it("merges two equality values into in", () =>
        check(["status=active", "status=pending"], {
          status: { op: "in", value: ["active", "pending"] },
        }));

      it("merges three equality values into in", () =>
        check(["status=active", "status=pending", "status=draft"], {
          status: { op: "in", value: ["active", "pending", "draft"] },
        }));

      it("merges equality into existing in", () =>
        check(["status:in=active,pending", "status=draft"], {
          status: { op: "in", value: ["active", "pending", "draft"] },
        }));

      it("merges in into existing equality", () =>
        check(["status=active", "status:in=pending,draft"], {
          status: { op: "in", value: ["active", "pending", "draft"] },
        }));

      it("merges two in filters", () =>
        check(["status:in=active,pending", "status:in=draft,complete"], {
          status: {
            op: "in",
            value: ["active", "pending", "draft", "complete"],
          },
        }));

      it("combines lower and upper bounds without losing exclusivity", () =>
        check(["priority>3", "priority<7"], {
          priority: {
            op: "range",
            value: [
              { value: 3, inclusive: false },
              { value: 7, inclusive: false },
            ],
          },
        }));

      it("normalizes the original week bounds in either order", () => {
        const expected: Filters = {
          weekPeriod: {
            op: "range",
            value: [
              "2026-W32" as CalendarInterval,
              "2026-W37" as CalendarInterval,
            ],
          },
        };
        check(["weekPeriod>=2026-W32", "weekPeriod<=2026-W37"], expected);
        check(["weekPeriod<=2026-W37", "weekPeriod>=2026-W32"], expected);
      });
      it("keeps the numerically tighter lower bound rather than lexical order", () =>
        check(["score>10", "score>=2"], { score: { op: "gt", value: 10 } }));
      it("keeps the tighter upper bound", () =>
        check(["score<=9", "score<5", "score<8"], {
          score: { op: "lt", value: 5 },
        }));
      it("makes equal bounds exclusive if either predicate excludes the endpoint", () => {
        check(["score>=3", "score>3"], { score: { op: "gt", value: 3 } });
        check(["score>3", "score>=3"], { score: { op: "gt", value: 3 } });
      });
      it("tightens both sides of an already merged range", () =>
        check(["score>=1", "score<=9", "score>3", "score<7"], {
          score: {
            op: "range",
            value: [
              { value: 3, inclusive: false },
              { value: 7, inclusive: false },
            ],
          },
        }));
      it("intersects explicit intervals with comparison bounds", () =>
        check(["score:range=[1,9]", "score:range=(3,8]", "score<7"], {
          score: {
            op: "range",
            value: [
              { value: 3, inclusive: false },
              { value: 7, inclusive: false },
            ],
          },
        }));
      it("preserves contradictory bounds as an empty range", () =>
        check(["score>9", "score<=3"], {
          score: { op: "range", value: [{ value: 9, inclusive: false }, 3] },
        }));
      it("compares canonical date bounds chronologically", () =>
        check(
          ["dueDate>=2026-01-01", "dueDate>2026-02-01", "dueDate<=2026-03-01"],
          {
            dueDate: {
              op: "range",
              value: [
                { value: "2026-02-01" as IsoDate, inclusive: false },
                "2026-03-01" as IsoDate,
              ],
            },
          },
        ));
      it("merges repeated not and notIn as exclusions", () =>
        check(
          ["status!=done", "status:notIn=archived,draft", "status!=cancelled"],
          {
            status: {
              op: "notIn",
              value: ["done", "archived", "draft", "cancelled"],
            },
          },
        ));
      it("merges numeric exclusion lists without string conversion", () =>
        check(["score:notIn=1,2", "score!=3", "score:notIn=4,5"], {
          score: { op: "notIn", value: [1, 2, 3, 4, 5] },
        }));
      it("rejects equality combined with a bound instead of dropping it", () => {
        expect(parseSerialFilters(["score=3", "score>1"])).toBeErrWithKey(
          "incompatible-filters",
        );
        expect(parseSerialFilters(["score>1", "score=3"])).toBeErrWithKey(
          "incompatible-filters",
        );
      });
      it("rejects include and exclude combinations", () => {
        expect(
          parseSerialFilters(["status:in=active,pending", "status!=pending"]),
        ).toBeErrWithKey("incompatible-filters");
      });
      it("rejects repeated contains instead of guessing AND or OR", () => {
        expect(
          parseSerialFilters(["title:contains=one", "title:contains=two"]),
        ).toBeErrWithKey("incompatible-filters");
      });
      it("rejects boolean alternatives that cannot be represented by in", () => {
        expect(
          parseSerialFilters(["favorite=true", "favorite=false"]),
        ).toBeErrWithKey("incompatible-filters");
      });
      it("rejects incompatible bound categories even in the same direction", () => {
        expect(
          parseSerialFilters(["score>3", "score>2026-W32"]),
        ).toBeErrWithKey("invalid-range-filter");
      });
      it("rejects mixed period granularities", () => {
        expect(
          parseSerialFilters(["period>=2026-W32", "period<=2026-09"]),
        ).toBeErrWithKey("invalid-range-filter");
      });
      it("does not silently overwrite explicit full-text search", () => {
        expect(parseSerialFilters(["$text=one", "two"])).toBeErrWithKey(
          "incompatible-filters",
        );
        expect(parseSerialFilters(["$text=one", "$text=two"])).toBeErrWithKey(
          "incompatible-filters",
        );
      });
      it("normalizes repeated bounds inside includes", () => {
        expect(
          throwIfError(parseSerialIncludes("tasks[score>=3,score<9](title)")),
        ).toEqual({
          tasks: {
            filters: {
              score: {
                op: "range",
                value: [3, { value: 9, inclusive: false }],
              },
            },
            includes: { title: true },
          },
        });
      });
      it("round-trips merged nested exclusions without treating list items as text", () => {
        const includes = throwIfError(
          parseSerialIncludes(
            "tasks[status!=done,status!=archived,type=Task](title)",
          ),
        );
        expect(includes).toEqual({
          tasks: {
            filters: {
              status: { op: "notIn", value: ["done", "archived"] },
              type: "Task",
            },
            includes: { title: true },
          },
        });
        expect(
          throwIfError(parseSerialIncludes(serializeIncludes(includes))),
        ).toEqual(includes);
      });
      it("round-trips merged nested equality alternatives", () => {
        const includes = throwIfError(
          parseSerialIncludes("tasks[status=active,status=pending](title)"),
        );
        expect(
          throwIfError(parseSerialIncludes(serializeIncludes(includes))),
        ).toEqual(includes);
      });
      it("reports incompatible nested filters with include context", () => {
        const result = parseSerialIncludes("tasks[score=3,score>1](title)");
        expect(result).toBeErrWithKey("incompatible-filters");
        expect(result).toMatchObject({
          error: { message: expect.stringContaining("tasks") },
        });
      });
      it("merges equality with numeric values", () =>
        check(["priority=1", "priority=2", "priority=3"], {
          priority: { op: "in", value: [1, 2, 3] },
        }));
    });

    describe("edge cases", () => {
      it("returns empty filters for empty input", () => check([], {}));

      it("skips whitespace-only tokens", () =>
        check(["  ", "type=Task"], { type: "Task" }));
    });
  });

  describe("serializeFilters", () => {
    const check = (filters: Filters, expected: string[]) => {
      expect(serializeFilters(filters)).toEqual(expected);
    };

    it("serializes simple equality", () =>
      check({ type: "Task" }, ["type=Task"]));

    it("serializes boolean value", () =>
      check({ favorite: true }, ["favorite=true"]));

    it("serializes numeric value", () =>
      check({ priority: 3 }, ["priority=3"]));

    it("serializes not-equal", () =>
      check({ status: { op: "not", value: "done" } }, ["status!=done"]));

    it("serializes gte", () =>
      check({ priority: { op: "gte", value: 3 } }, ["priority>=3"]));

    it("serializes in", () =>
      check({ status: { op: "in", value: ["open", "done"] } }, [
        "status:in=open,done",
      ]));

    it("serializes empty true", () =>
      check({ assignee: { op: "empty", value: true } }, ["assignee:empty"]));

    it("serializes empty false", () =>
      check({ assignee: { op: "empty", value: false } }, [
        "assignee:notEmpty",
      ]));

    it("serializes match", () =>
      check({ title: { op: "match", value: "urgent" } }, [
        "title:match=urgent",
      ]));

    it("serializes $text as plain text", () =>
      check({ $text: "urgent bug", type: "Task" }, [
        "urgent bug",
        "type=Task",
      ]));

    it("serializes array value as :in", () =>
      check({ tags: ["a", "b"] }, ["tags:in=a,b"]));

    describe("round-trip", () => {
      const checkRoundTrip = (filters: Filters) => {
        expect(
          throwIfError(parseSerialFilters(serializeFilters(filters))),
        ).toEqual(filters);
      };

      it("simple equality", () =>
        checkRoundTrip({ type: "Task", status: "done" }));

      it("numeric", () => checkRoundTrip({ priority: 3 }));

      it("complex operators", () =>
        checkRoundTrip({
          status: { op: "not", value: "done" },
          priority: { op: "gte", value: 3 },
        }));

      it("in operator", () =>
        checkRoundTrip({ status: { op: "in", value: ["open", "done"] } }));

      it("empty operator", () =>
        checkRoundTrip({ assignee: { op: "empty", value: true } }));
    });
  });

  describe("parseSerialIncludes", () => {
    const check = (input: string, expected: Includes) => {
      expect(parseSerialIncludes(input)).toBeOkWith(expected);
    };

    const checkError = (input: string, errorKey: string) => {
      expect(parseSerialIncludes(input)).toBeErrWithKey(errorKey);
    };

    describe("flat fields", () => {
      it("parses single field", () => check("title", { title: true }));

      it("parses multiple fields", () =>
        check("title,status,tags", {
          title: true,
          status: true,
          tags: true,
        }));
    });

    describe("nested fields", () => {
      it("parses single nested field", () =>
        check("project(title)", { project: { title: true } }));

      it("parses nested with multiple sub-fields", () =>
        check("project(title,status)", {
          project: { title: true, status: true },
        }));

      it("parses deeply nested", () =>
        check("project(owner(name,email))", {
          project: { owner: { name: true, email: true } },
        }));

      it("parses spec example", () =>
        check(
          "project(title,owner(name,email)),comments(body,author(name)),tags",
          {
            project: { title: true, owner: { name: true, email: true } },
            comments: { body: true, author: { name: true } },
            tags: true,
          },
        ));
    });

    describe("whitespace", () => {
      it("trims outer whitespace", () => check("  title  ", { title: true }));

      it("handles whitespace around commas", () =>
        check("title , status , tags", {
          title: true,
          status: true,
          tags: true,
        }));

      it("handles whitespace around parentheses", () =>
        check("project( title , status )", {
          project: { title: true, status: true },
        }));

      it("handles whitespace in nested", () =>
        check("project( title , owner( name , email ) ) , tags", {
          project: { title: true, owner: { name: true, email: true } },
          tags: true,
        }));
    });

    describe("filtered includes", () => {
      it("preserves explicit full-text equality in relation filters", () =>
        check("tasks[$text=urgent](title)", {
          tasks: {
            filters: { $text: "urgent" },
            includes: { title: true },
          },
        }));

      it("parses filter only (no sub-fields)", () =>
        check("relatesTo[type=Task]", {
          relatesTo: { filters: { type: "Task" } },
        }));

      it("parses filter with sub-fields", () =>
        check("relatesTo[type=Task](title,status)", {
          relatesTo: {
            filters: { type: "Task" },
            includes: { title: true, status: true },
          },
        }));

      it("parses multiple filters with operator", () =>
        check("children[status=active,priority>=3](title)", {
          children: {
            filters: {
              status: "active",
              priority: { op: "gte", value: 3 },
            },
            includes: { title: true },
          },
        }));

      it("parses filter with nested sub-fields", () =>
        check("relatesTo[type=Task](title,assignee(name))", {
          relatesTo: {
            filters: { type: "Task" },
            includes: { title: true, assignee: { name: true } },
          },
        }));

      it("parses mixed filtered and unfiltered fields", () =>
        check("relatesTo[type=Task](title),tags", {
          relatesTo: {
            filters: { type: "Task" },
            includes: { title: true },
          },
          tags: true,
        }));

      it("parses multiple filtered fields", () =>
        check("a[type=X],b[type=Y](name)", {
          a: { filters: { type: "X" } },
          b: { filters: { type: "Y" }, includes: { name: true } },
        }));

      it("parses unfiltered nested alongside filtered", () =>
        check("project(title,owner(name)),relatesTo[type=Task](status)", {
          project: { title: true, owner: { name: true } },
          relatesTo: {
            filters: { type: "Task" },
            includes: { status: true },
          },
        }));

      it("handles whitespace around brackets", () =>
        check("relatesTo[ type=Task ]( title , status )", {
          relatesTo: {
            filters: { type: "Task" },
            includes: { title: true, status: true },
          },
        }));
    });

    describe("field names with underscore and digits", () => {
      it("parses field with underscore", () =>
        check("my_field", { my_field: true }));

      it("rejects field starting with underscore", () =>
        checkError("_private", "invalid-field-name"));

      it("parses field with digits", () => check("field2", { field2: true }));
    });

    describe("errors", () => {
      it("rejects empty string", () => checkError("", "empty-includes"));

      it("rejects whitespace-only", () => checkError("   ", "empty-includes"));

      it("rejects unmatched opening paren", () =>
        checkError("project(title", "unmatched-paren"));

      it("rejects unmatched closing paren", () =>
        checkError("project)title", "unmatched-paren"));

      it("rejects empty field name between commas", () =>
        checkError("title,,status", "empty-field-name"));

      it("rejects trailing comma", () =>
        checkError("title,", "empty-field-name"));

      it("rejects unmatched opening bracket", () =>
        checkError("relatesTo[type=Task", "unmatched-bracket"));

      it("rejects unmatched closing bracket", () =>
        checkError("relatesTo]type=Task", "unmatched-bracket"));

      it("rejects parens before brackets", () =>
        checkError("relatesTo(title)[type=Task]", "brackets-after-parens"));

      it("rejects empty brackets", () =>
        checkError("relatesTo[](title)", "empty-filter"));
    });
  });

  describe("serializeIncludes", () => {
    const check = (includes: Includes, expected: string) => {
      expect(serializeIncludes(includes)).toBe(expected);
    };

    it("serializes flat fields", () =>
      check({ title: true, status: true }, "title,status"));

    it("serializes nested fields", () =>
      check(
        { project: { title: true, status: true } },
        "project(title,status)",
      ));

    it("serializes deeply nested", () =>
      check(
        { project: { title: true, owner: { name: true } }, tags: true },
        "project(title,owner(name)),tags",
      ));

    it("skips false values", () =>
      check({ title: true, hidden: false }, "title"));

    describe("filtered includes", () => {
      it("serializes IncludesQuery with filters only", () =>
        check(
          { relatesTo: { filters: { type: "Task" } } as IncludesQuery },
          "relatesTo[type=Task]",
        ));

      it("serializes IncludesQuery with filters and includes", () =>
        check(
          {
            relatesTo: {
              filters: { type: "Task" },
              includes: { title: true, status: true },
            } as IncludesQuery,
          },
          "relatesTo[type=Task](title,status)",
        ));

      it("serializes IncludesQuery with includes only as plain nested", () =>
        check(
          {
            relatesTo: {
              includes: { title: true },
            } as IncludesQuery,
          },
          "relatesTo(title)",
        ));
    });

    describe("round-trip", () => {
      const checkRoundTrip = (input: string) => {
        const parsed = throwIfError(parseSerialIncludes(input));
        expect(serializeIncludes(parsed)).toBe(input);
      };

      it("flat fields", () => checkRoundTrip("title,status,tags"));

      it("nested", () =>
        checkRoundTrip("project(title,owner(name,email)),tags"));

      it("single field", () => checkRoundTrip("title"));

      it("single nested", () => checkRoundTrip("project(title)"));

      it("filtered with sub-fields", () =>
        checkRoundTrip("relatesTo[type=Task](title,status)"));

      it("filtered without sub-fields", () =>
        checkRoundTrip("relatesTo[type=Task]"));

      it("mixed filtered and unfiltered", () =>
        checkRoundTrip("a[type=X](title),b(name),c"));

      it("multiple filters with operator", () =>
        checkRoundTrip(
          "children[status=active,priority>=3](title,assignee(name))",
        ));
    });
  });

  describe("parseSerialOrderBy", () => {
    const check = (input: string, expected: string[]) => {
      expect(parseSerialOrderBy(input)).toEqual(expected);
    };

    it("parses ascending field", () => check("createdAt", ["createdAt"]));

    it("parses descending field", () => check("!priority", ["!priority"]));

    it("parses multiple fields", () =>
      check("!priority,createdAt", ["!priority", "createdAt"]));

    it("handles whitespace", () =>
      check(" !priority , createdAt ", ["!priority", "createdAt"]));

    it("filters empty segments", () =>
      check("!priority,,createdAt", ["!priority", "createdAt"]));
  });

  describe("serializeOrderBy", () => {
    const check = (orderBy: string[], expected: string) => {
      expect(serializeOrderBy(orderBy)).toBe(expected);
    };

    it("serializes order fields", () =>
      check(["!priority", "createdAt"], "!priority,createdAt"));

    it("round-trips", () => {
      const input = "!priority,createdAt";
      expect(serializeOrderBy(parseSerialOrderBy(input))).toBe(input);
    });
  });
});
