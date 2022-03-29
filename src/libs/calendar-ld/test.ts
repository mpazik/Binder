import type { Day } from "./index";
import { getIntervalData, isInstantWithin } from "./index";

describe("getIntervalData", () => {
  test("handle instant uri", () => {
    const interval = getIntervalData(
      "http://id.docland.app/intervals/instant/2022-02-12T03:12:34"
    );

    expect(interval).toEqual({
      "@context": "http://www.w3.org/2006/time",
      "@id": "http://id.docland.app/intervals/instant/2022-02-12T03:12:34",
      "@type": "Instant",
      inXSDDateTimeStamp: "2022-02-12T03:12:34.000Z",
    });
  });

  test("handle day uri", () => {
    const interval = getIntervalData(
      "http://id.docland.app/intervals/day/2022-02-12"
    );

    expect(interval).toEqual({
      "@context": "http://www.w3.org/2006/time",
      "@id": "http://id.docland.app/intervals/day/2022-02-12",
      "@type": "unitDay",
      intervalMeets: "http://id.docland.app/intervals/day/2022-02-13",
      intervalMetBy: "http://id.docland.app/intervals/day/2022-02-11",
      hasBeginning:
        "http://id.docland.app/intervals/instant/2022-02-12T00:00:00",
      hasEnd: "http://id.docland.app/intervals/instant/2022-02-13T00:00:00",
      intervalDuring: [
        "http://id.docland.app/intervals/week/2022-W06",
        "http://id.docland.app/intervals/month/2022-02",
        "http://id.docland.app/intervals/year/2022",
      ],
      intervalContains: [],
    });
  });

  test("handle week uri during time change", () => {
    const interval = getIntervalData(
      "http://id.docland.app/intervals/week/2022-W13"
    );
    expect(interval).toEqual({
      "@context": "http://www.w3.org/2006/time",
      "@id": "http://id.docland.app/intervals/week/2022-W13",
      "@type": "unitWeek",
      intervalMetBy: "http://id.docland.app/intervals/week/2022-W12",
      intervalMeets: "http://id.docland.app/intervals/week/2022-W14",
      hasBeginning:
        "http://id.docland.app/intervals/instant/2022-03-28T00:00:00",
      hasEnd: "http://id.docland.app/intervals/instant/2022-04-04T00:00:00",
      intervalDuring: ["http://id.docland.app/intervals/year/2022"],
      intervalContains: [
        "http://id.docland.app/intervals/day/2022-03-28",
        "http://id.docland.app/intervals/day/2022-03-29",
        "http://id.docland.app/intervals/day/2022-03-30",
        "http://id.docland.app/intervals/day/2022-03-31",
        "http://id.docland.app/intervals/day/2022-04-01",
        "http://id.docland.app/intervals/day/2022-04-02",
        "http://id.docland.app/intervals/day/2022-04-03",
      ],
      intervalOverlappedBy: ["http://id.docland.app/intervals/month/2022-03"],
      intervalOverlaps: ["http://id.docland.app/intervals/month/2022-04"],
    });
  });

  test("handle week uri at the begging of a year", () => {
    const interval = getIntervalData(
      "http://id.docland.app/intervals/week/2021-W52"
    );
    expect(interval).toMatchObject({
      "@id": "http://id.docland.app/intervals/week/2021-W52",
      intervalMetBy: "http://id.docland.app/intervals/week/2021-W51",
      intervalMeets: "http://id.docland.app/intervals/week/2022-W01",
      intervalDuring: [],
      intervalContains: [
        "http://id.docland.app/intervals/day/2021-12-27",
        "http://id.docland.app/intervals/day/2021-12-28",
        "http://id.docland.app/intervals/day/2021-12-29",
        "http://id.docland.app/intervals/day/2021-12-30",
        "http://id.docland.app/intervals/day/2021-12-31",
        "http://id.docland.app/intervals/day/2022-01-01",
        "http://id.docland.app/intervals/day/2022-01-02",
      ],
      intervalOverlappedBy: [
        "http://id.docland.app/intervals/month/2021-12",
        "http://id.docland.app/intervals/year/2021",
      ],
      intervalOverlaps: [
        "http://id.docland.app/intervals/month/2022-01",
        "http://id.docland.app/intervals/year/2022",
      ],
    });
  });

  test("handle month uri", () => {
    const interval = getIntervalData(
      "http://id.docland.app/intervals/month/2022-02"
    );
    expect(interval).toEqual({
      "@context": "http://www.w3.org/2006/time",
      "@id": "http://id.docland.app/intervals/month/2022-02",
      "@type": "unitMonth",
      intervalMetBy: "http://id.docland.app/intervals/month/2022-01",
      intervalMeets: "http://id.docland.app/intervals/month/2022-03",
      hasBeginning:
        "http://id.docland.app/intervals/instant/2022-02-01T00:00:00",
      hasEnd: "http://id.docland.app/intervals/instant/2022-03-01T00:00:00",
      intervalDuring: ["http://id.docland.app/intervals/year/2022"],
      intervalContains: [
        "http://id.docland.app/intervals/week/2022-W06",
        "http://id.docland.app/intervals/week/2022-W07",
        "http://id.docland.app/intervals/week/2022-W08",
      ],
      intervalOverlappedBy: ["http://id.docland.app/intervals/week/2022-W05"],
      intervalOverlaps: ["http://id.docland.app/intervals/week/2022-W09"],
    });
  });

  test.only("handle month uri at the begging of a year", () => {
    const interval = getIntervalData(
      "http://id.docland.app/intervals/month/2022-01"
    );
    expect(interval).toEqual({
      "@context": "http://www.w3.org/2006/time",
      "@id": "http://id.docland.app/intervals/month/2022-01",
      "@type": "unitMonth",
      intervalMetBy: "http://id.docland.app/intervals/month/2021-12",
      intervalMeets: "http://id.docland.app/intervals/month/2022-02",
      hasBeginning:
        "http://id.docland.app/intervals/instant/2022-01-01T00:00:00",
      hasEnd: "http://id.docland.app/intervals/instant/2022-02-01T00:00:00",
      intervalDuring: ["http://id.docland.app/intervals/year/2022"],
      intervalContains: [
        "http://id.docland.app/intervals/week/2022-W01",
        "http://id.docland.app/intervals/week/2022-W02",
        "http://id.docland.app/intervals/week/2022-W03",
        "http://id.docland.app/intervals/week/2022-W04",
      ],
      intervalOverlappedBy: ["http://id.docland.app/intervals/week/2021-W52"],
      intervalOverlaps: ["http://id.docland.app/intervals/week/2022-W05"],
    });
  });

  test("handle month uri when month starts at the begging of a week", () => {
    const interval = getIntervalData(
      "http://id.docland.app/intervals/month/2022-08"
    );
    expect(interval).toMatchObject({
      intervalContains: [
        "http://id.docland.app/intervals/week/2022-W31",
        "http://id.docland.app/intervals/week/2022-W32",
        "http://id.docland.app/intervals/week/2022-W33",
        "http://id.docland.app/intervals/week/2022-W34",
      ],
      intervalOverlappedBy: [],
      intervalOverlaps: ["http://id.docland.app/intervals/week/2022-W35"],
    });
  });
  test("handle month uri when month ends at the end of a week", () => {
    const interval = getIntervalData(
      "http://id.docland.app/intervals/month/2022-07"
    );
    expect(interval).toMatchObject({
      intervalContains: [
        "http://id.docland.app/intervals/week/2022-W27",
        "http://id.docland.app/intervals/week/2022-W28",
        "http://id.docland.app/intervals/week/2022-W29",
        "http://id.docland.app/intervals/week/2022-W30",
      ],
      intervalOverlappedBy: ["http://id.docland.app/intervals/week/2022-W26"],
      intervalOverlaps: [],
    });
  });

  test("handle year uri", () => {
    const interval = getIntervalData(
      "http://id.docland.app/intervals/year/2022"
    );
    expect(interval).toEqual({
      "@context": "http://www.w3.org/2006/time",
      "@id": "http://id.docland.app/intervals/year/2022",
      "@type": "unitYear",
      intervalMetBy: "http://id.docland.app/intervals/year/2021",
      intervalMeets: "http://id.docland.app/intervals/year/2023",
      hasBeginning:
        "http://id.docland.app/intervals/instant/2022-01-01T00:00:00",
      hasEnd: "http://id.docland.app/intervals/instant/2023-01-01T00:00:00",
      intervalDuring: [],
      intervalContains: [
        "http://id.docland.app/intervals/month/2022-01",
        "http://id.docland.app/intervals/month/2022-02",
        "http://id.docland.app/intervals/month/2022-03",
        "http://id.docland.app/intervals/month/2022-04",
        "http://id.docland.app/intervals/month/2022-05",
        "http://id.docland.app/intervals/month/2022-06",
        "http://id.docland.app/intervals/month/2022-07",
        "http://id.docland.app/intervals/month/2022-08",
        "http://id.docland.app/intervals/month/2022-09",
        "http://id.docland.app/intervals/month/2022-10",
        "http://id.docland.app/intervals/month/2022-11",
        "http://id.docland.app/intervals/month/2022-12",
      ],
    });
  });
});

describe("isInstantWithin", () => {
  const getIntervalDay = () =>
    getIntervalData("http://id.docland.app/intervals/day/2022-02-12") as Day;

  const check = (instant: string, expectation: boolean) => () => {
    expect(isInstantWithin(getIntervalDay(), new Date(instant))).toEqual(
      expectation
    );
  };

  test(
    "returns false if instance is before the interval",
    check("2022-02-11T23:12:34Z", false)
  );

  test(
    "returns true if instance is on the interval start time",
    check("2022-02-12T00:00:00Z", true)
  );

  test(
    "returns true if instance is after start time and before end time",
    check("2022-02-12T11:21:53Z", true)
  );

  test(
    "returns false if instance is after end time",
    check("2022-02-13T11:21:53Z", false)
  );

  test(
    "returns false if instance is on end time",
    check("2022-02-13T00:00:00Z", false)
  );
});
