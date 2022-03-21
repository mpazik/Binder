import { expandText, indexOfWordEnd, indexOfWordStart } from "./string-expand";

const expand = (
  text: string,
  part: string,
  occurrence = 1
): [prefix: string, suffix: string] => {
  const length = part.length;
  let firstStart = text.indexOf(part);
  for (; occurrence > 1; occurrence--) {
    firstStart = text.indexOf(part, firstStart + length);
  }
  return expandText(text, firstStart, firstStart + length);
};

describe("indexOfWordStart", () => {
  test("returns position of word start", () => {
    expect(indexOfWordStart("some text and", 8)).toEqual(5);
  });
  test("returns position of next word start in on a black space", () => {
    expect(indexOfWordStart("some text and", 4)).toEqual(0);
  });
  test("returns position of word start when on word start", () => {
    expect(indexOfWordStart("some text and", 5)).toEqual(5);
  });
  test("returns start if on start", () => {
    expect(indexOfWordStart("some text and", 0)).toEqual(0);
  });
  test("returns start when trying to search back first word", () => {
    expect(indexOfWordStart("some text and", -1)).toEqual(0);
  });
  test("returns position no lower than limit", () => {
    expect(indexOfWordStart("some-very-long-word", 14)).toEqual(4);
  });
  test("ignores multiple types of white spaces", () => {
    // unicode not supported
    expect(indexOfWordStart("some\ntext and", 8)).toEqual(5);
    expect(indexOfWordStart("some\ttext and", 8)).toEqual(5);
    expect(indexOfWordStart("some\ftext and", 8)).toEqual(5);
    expect(indexOfWordStart("some\rtext and", 8)).toEqual(5);
    expect(indexOfWordStart("some\vtext and", 8)).toEqual(5);
  });
});

describe("indexOfWordEnd", () => {
  test("returns position of word start", () => {
    expect(indexOfWordEnd("some text and", 8)).toEqual(9);
  });
  test("returns position of next word start in on a black space", () => {
    expect(indexOfWordEnd("some text and", 4)).toEqual(9);
  });
  test("returns start if on start", () => {
    expect(indexOfWordEnd("some text and", 13)).toEqual(13);
  });
  test("returns position no higher than limit", () => {
    expect(indexOfWordEnd("some-very-long-word", 4)).toEqual(14);
  });
});

test("expands to be larger than 20 characters", () => {
  expect(expand("some text and something else", "text")).toEqual([
    "some ",
    " and something",
  ]);
});

test("starts expansion from suffix", () => {
  expect(expand("some text and something else", "text and something")).toEqual([
    "",
    " else",
  ]);
});

test("expands to be larger than 20 characters when there is no prefix", () => {
  expect(expand("some text and something else", "some")).toEqual([
    "",
    " text and something",
  ]);
});

test("expands to be larger than 20 characters when there is no suffix", () => {
  expect(expand("some text and something else", "else")).toEqual([
    "text and something ",
    "",
  ]);
});

test("expands to full text if text is shorter than 20 characters", () => {
  expect(expand("some text and else", "text")).toEqual(["some ", " and else"]);
});

test("does not expands if text is equal to the searching part", () => {
  expect(expand("text", "text")).toEqual(["", ""]);
});

test("does not expand if search is over 20 characters and there is no repetition", () => {
  expect(
    expand("there is something I want to say but", "is something I want to")
  ).toEqual(["", ""]);
});

test("does expand until there is no repetition", () => {
  expect(
    expand(
      "There is something I want to say but there is something I want to say but there is something I want to say but",
      "is something",
      3
    )
  ).toEqual([
    "there is something I want to say but there ",
    " I want to say but",
  ]);
});
