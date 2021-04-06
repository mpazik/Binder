import { parsePdfDate } from "./pdf-processor";

describe("parsePdfDate", () => {
  test("parse date", () => {
    expect(parsePdfDate("D:19990220")).toEqual("1999-02-20");
  });

  test("parse date with only year", () => {
    expect(parsePdfDate("D:1999")).toEqual("1999-01-01");
    expect(parsePdfDate("1999")).toEqual("1999-01-01");
  });

  test("parse date with hour", () => {
    expect(parsePdfDate("D:1999022021")).toEqual("1999-02-20T21");
  });

  test("parse date with hour and minute", () => {
    expect(parsePdfDate("D:199902202120")).toEqual("1999-02-20T21:20");
  });

  test("parse date with full time", () => {
    expect(parsePdfDate("D:19990220212000")).toEqual("1999-02-20T21:20:00");
  });

  test("parse date with local timezone", () => {
    expect(parsePdfDate("D:19990220212000Z")).toEqual("1999-02-20T21:20:00Z");
  });

  test("can not parse date with wrong timezone sign", () => {
    expect(parsePdfDate("D:19990220212000S")).toBeUndefined();
  });

  test("parse date with timezone hour offset", () => {
    expect(parsePdfDate("D:19990220212000-03")).toEqual(
      "1999-02-20T21:20:00-03"
    );
  });

  test("parse date with timezone full offset", () => {
    expect(parsePdfDate("D:19990220212000+10'30'")).toEqual(
      "1999-02-20T21:20:00+10:30"
    );
  });

  test("can not parse when timezone minute offset is not wrapped", () => {
    expect(parsePdfDate("D:19990220212000+1030")).toBeUndefined();
  });

  test("parse date even if doesn't have starting code", () => {
    expect(parsePdfDate("19990220212000")).toEqual("1999-02-20T21:20:00");
  });

  test("can not parse date is invalid", () => {
    expect(parsePdfDate("D:test0220212000")).toBeUndefined();
    expect(parsePdfDate("D:1991ab20212000")).toBeUndefined();
  });

  test("can not parse if staring string is invalid", () => {
    expect(parsePdfDate("S:19910220212000")).toBeUndefined();
    expect(parsePdfDate("d:19910220212000")).toBeUndefined();
  });

  test("returns undefined if date is to short", () => {
    expect(parsePdfDate("D:199")).toBeUndefined();
    expect(parsePdfDate("199")).toBeUndefined();
  });
});
