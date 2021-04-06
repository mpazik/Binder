import { getNameFromUrl } from "./utils";

describe("getNameFromUrl", () => {
  test("returns last segment as a name", () => {
    expect(getNameFromUrl("http://domain.com/name")).toEqual("name");
  });

  test("returns last segment as a name ignoring trailing slash", () => {
    expect(getNameFromUrl("http://domain.com/name/")).toEqual("name");
  });

  test("returns last segment as a name ignoring file extension", () => {
    expect(getNameFromUrl("http://domain.com/name.txt")).toEqual("name");
  });

  test("returns last segment as a name url decoded", () => {
    expect(getNameFromUrl("http://domain.com/my%20name")).toEqual("my name");
  });

  test("returns undefined if there is no path", () => {
    expect(getNameFromUrl("http://domain.com")).toBeUndefined();
  });

  test("returns undefined when path is empty", () => {
    expect(getNameFromUrl("http://domain.com//")).toBeUndefined();
  });

  test("returns undefined for non valid url", () => {
    expect(getNameFromUrl("test")).toBeUndefined();
  });
});
