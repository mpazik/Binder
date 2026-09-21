import { describe, expect, it } from "bun:test";
import { parseSerialFilters, parseSerialIncludes } from "@binder/repo";
import { isErr, throwIfError, type CalendarInterval } from "@binder/utils";
import { tokenizeSearchQuery } from "./search-query.ts";

const tokens = (...args: string[]) => throwIfError(tokenizeSearchQuery(args));
const filters = (...args: string[]) =>
  throwIfError(parseSerialFilters(tokens(...args)));

describe("search argv predicates", () => {
  it("preserves interval delimiters in grouped range predicates", () => {
    expect(filters("type=Task score:range=[1,4) status=active")).toEqual({
      type: "Task",
      score: { op: "range", value: [1, { value: 4, inclusive: false }] },
      status: "active",
    });
  });

  it("preserves explicit full-text equality in grouped and separate arguments", () => {
    expect(tokens("type=Task $text=urgent")).toEqual([
      "type=Task",
      "$text=urgent",
    ]);
    expect(filters("type=Task $text=urgent")).toEqual({
      type: "Task",
      $text: "urgent",
    });
    expect(filters("type=Task", "$text=urgent")).toEqual({
      type: "Task",
      $text: "urgent",
    });
    expect(filters('$text="urgent status=active" type=Task')).toEqual({
      $text: "urgent status=active",
      type: "Task",
    });
  });

  it("does not split at arbitrary reserved or invalid field names", () => {
    expect(
      tokens("title=Discuss $other=urgent $textExtra=urgent 123field=urgent"),
    ).toEqual([
      "title=Discuss $other=urgent $textExtra=urgent 123field=urgent",
    ]);
  });

  it("passes grouped numeric bounds to range normalization", () => {
    expect(tokens("score>=3 score<=9")).toEqual(["score>=3", "score<=9"]);
    expect(filters("score>=3 score<=9")).toEqual({
      score: { op: "range", value: [3, 9] },
    });
  });
  it("accepts normalized weeks and dates without numeric special cases", () => {
    expect(
      tokens("weekPeriod>=2026-W32 weekPeriod<=2026-W37 date>2026-01-01"),
    ).toEqual([
      "weekPeriod>=2026-W32",
      "weekPeriod<=2026-W37",
      "date>2026-01-01",
    ]);
    expect(filters("weekPeriod>=2026-W32 weekPeriod<=2026-W37")).toEqual({
      weekPeriod: {
        op: "range",
        value: ["2026-W32" as CalendarInterval, "2026-W37" as CalendarInterval],
      },
    });
  });
  it("groups equality, booleans, exclusions, and all named operators", () => {
    const separate = [
      "type=Task",
      "status!=done",
      "favorite=true",
      "tags:in=a,b",
      "excludedTags:notIn=c,d",
      "title:contains=Fix",
      "body:notContains=draft",
      "name:match=hello",
      "owner:empty",
      "project:notEmpty",
    ];
    expect(tokens(separate.join(" "))).toEqual(separate);
    expect(filters(separate.join(" "))).toEqual(
      throwIfError(parseSerialFilters(separate)),
    );
  });
  it("preserves spaced values and separate arguments", () => {
    expect(filters("title=Fix login", "type=Task")).toEqual({
      title: "Fix login",
      type: "Task",
    });
    expect(tokens("title=Fix login status=active")).toEqual([
      "title=Fix login",
      "status=active",
    ]);
  });
  it("preserves plain text even when later words look like predicates", () => {
    expect(filters("deployment issues", "type=Task")).toEqual({
      $text: "deployment issues",
      type: "Task",
    });
    expect(filters("Discuss score>=3")).toEqual({ $text: "Discuss score>=3" });
  });
  it("uses inner JSON quotes to protect predicate-looking literal text", () => {
    expect(filters('title="Discuss score>=3" status=active')).toEqual({
      title: "Discuss score>=3",
      status: "active",
    });
    expect(filters('title="" status=active')).toEqual({
      title: "",
      status: "active",
    });
  });
  it("decodes JSON escapes without treating apostrophes as delimiters", () => {
    expect(
      filters('title="Say \\"hello\\" at C:\\\\tmp" status=active'),
    ).toEqual({ title: 'Say "hello" at C:\\tmp', status: "active" });
    expect(filters("title=Don't break login status=active")).toEqual({
      title: "Don't break login",
      status: "active",
    });
  });
  it("matches operators only after the field, never inside a value", () => {
    expect(filters("title=a>=b:c:in=x status!=done")).toEqual({
      title: "a>=b:c:in=x",
      status: { op: "not", value: "done" },
    });
    expect(tokens("title=Fix 123bad=x status=active")).toEqual([
      "title=Fix 123bad=x",
      "status=active",
    ]);
  });
  it("requires complete no-value operator names", () => {
    expect(tokens("owner:empty\tproject:notEmpty\nstatus=active")).toEqual([
      "owner:empty",
      "project:notEmpty",
      "status=active",
    ]);
    expect(filters("owner:emptyish")).toEqual({ $text: "owner:emptyish" });
  });
  it("rejects unterminated explicit quotes and invalid escapes", () => {
    expect(tokenizeSearchQuery(['title="unfinished status=active'])).toEqual({
      error: {
        key: "invalid-search-query",
        message:
          "Unterminated quoted filter value. Use JSON double quotes and escapes inside the shell argument.",
      },
    });
    expect(isErr(tokenizeSearchQuery(['title="bad\\q"']))).toBe(true);
  });
  it("rejects trailing text after a quoted value or no-value operator", () => {
    expect(isErr(tokenizeSearchQuery(['title="Fix"suffix']))).toBe(true);
    expect(isErr(tokenizeSearchQuery(['title="Fix" login']))).toBe(true);
    expect(isErr(tokenizeSearchQuery(["owner:empty junk"]))).toBe(true);
  });
  it("keeps includes on their existing comma-separated grammar", () => {
    expect(parseSerialIncludes("tasks[status=active](title)")).toEqual({
      data: {
        tasks: { filters: { status: "active" }, includes: { title: true } },
      },
    });
  });
});
