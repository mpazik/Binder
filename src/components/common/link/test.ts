import { getLinkTarget, isAbsoluteUrl } from "./index";

test("isAbsoluteUrl", async () => {
  expect(isAbsoluteUrl("http://test.org")).toBe(true);
  expect(isAbsoluteUrl("https://test.org")).toBe(true);
  expect(isAbsoluteUrl("mailto:someone@test.com")).toBe(true);
  expect(isAbsoluteUrl("nih:sha-256;20fb02c545907ba0bd")).toBe(true);
  expect(isAbsoluteUrl("test")).toBe(false);
  expect(isAbsoluteUrl("/test")).toBe(false);
});

describe("getLinkTarget", () => {
  test("opens new tab for absolute url", async () => {
    expect(getLinkTarget("http://test.org")).toBe("_blank");
    expect(getLinkTarget("https://test.org")).toBe("_blank");
    expect(getLinkTarget("mailto:someone@test.com")).toBe("_blank");
  });

  test("open in current tab for internal pages", async () => {
    expect(getLinkTarget("test")).toBe("_self");
    expect(getLinkTarget("/test")).toBe("_self");
  });
});
