import { getIntervalData } from "./index";

test("handle day uri", () => {
  const interval = getIntervalData(
    "http://id.docland.app/intervals/day/2016-02-12"
  );

  expect(interval).toEqual({
    "@context": "http://www.w3.org/2006/time",
    "@id": "http://id.docland.app/intervals/day/2016-02-12",
    "@type": "unitDay",
    intervalMeets: "http://id.docland.app/intervals/day/2016-02-13",
    intervalMetBy: "http://id.docland.app/intervals/day/2016-02-11",
    hasBeginning: "http://id.docland.app/intervals/instant/2016-02-12T00:00:00",
    hasEnd: "http://id.docland.app/intervals/instant/2016-02-13T00:00:00",
    intervalDuring: [
      "http://id.docland.app/intervals/week/2016-W6",
      "http://id.docland.app/intervals/month/2016-02",
      "http://id.docland.app/intervals/quarter/2016-Q1",
      "http://id.docland.app/intervals/year/2016",
    ],
    intervalContains: [],
    dayOfWeek: "http://www.w3.org/2006/time#Friday",
    monthOfYear: "http://www.w3.org/ns/time/gregorian#February",
  });
});

test("handle instant uri", () => {
  const interval = getIntervalData(
    "http://id.docland.app/intervals/instant/2016-02-12T03:12:34"
  );

  expect(interval).toEqual({
    "@context": "http://www.w3.org/2006/time",
    "@id": "http://id.docland.app/intervals/instant/2016-02-12T03:12:34",
    "@type": "Instant",
    inXSDDateTimeStamp: "2016-02-12T03:12:34.000Z",
  });
});
