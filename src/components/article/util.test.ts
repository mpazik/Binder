import { createInPartsFinder2, findInParts, findInParts2 } from "./util";

test("can find a string spread across all parts", () => {
  expect(findInParts(["and some", "thi", "ng and else"], "something")).toEqual([
    ["and some", "thi", "ng and else"],
    4,
    2,
  ]);
});

test("omits parts that doesn't include searching string", () => {
  expect(findInParts(["and", " s", "omethi", "ng", "else"], "some")).toEqual([
    [" s", "omethi"],
    1,
    3,
  ]);
});

test("handles start and end edge conditions", () => {
  expect(findInParts(["s", "om", "e"], "some")).toEqual([
    ["s", "om", "e"],
    0,
    1,
  ]);
});

test("can find a string in a single part", () => {
  expect(findInParts(["and", " something", "else"], "some")).toEqual([
    [" something"],
    1,
    5,
  ]);
});

test("can find match in the first part after failed match", () => {
  expect(findInParts(["and so", " and something"], "some")).toEqual([
    [" and something"],
    5,
    9,
  ]);
});

test("can", () => {
  expect(findInParts2(["and", " something", "else"], "some")).toEqual([
    [" something"],
    1,
    5,
  ]);
});
