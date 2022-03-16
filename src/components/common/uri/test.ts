import { getLinkTarget, isAbsoluteUri } from "./index";

test("isAbsoluteUri", async () => {
  expect(isAbsoluteUri("http://test.org")).toBe(true);
  expect(isAbsoluteUri("https://test.org")).toBe(true);
  expect(isAbsoluteUri("https://  test.org")).toBe(false);
  expect(isAbsoluteUri("mailto:someone@test.com")).toBe(true);
  expect(isAbsoluteUri("nih:sha-256;20fb02c545907ba0bd")).toBe(true);
  expect(isAbsoluteUri("test")).toBe(false);
  expect(isAbsoluteUri("_:test")).toBe(false);
  expect(isAbsoluteUri("/test")).toBe(false);
});

describe("getLinkTarget", () => {
  test("opens new tab for absolute uri", async () => {
    expect(getLinkTarget("http://test.org")).toBe("_blank");
    expect(getLinkTarget("https://test.org")).toBe("_blank");
    expect(getLinkTarget("mailto:someone@test.com")).toBe("_blank");
  });

  test("open in current tab for internal pages", async () => {
    expect(getLinkTarget("test")).toBe("_self");
    expect(getLinkTarget("/test")).toBe("_self");
  });
});
