import { getLinkTarget } from "./index";

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
