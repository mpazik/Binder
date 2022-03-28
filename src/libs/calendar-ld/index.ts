import type { Uri } from "../../components/common/uri";

type IsoDate = string;
type InstantUri = Uri;
export type IntervalUri = Uri;
type DayUri = IntervalUri;
type WeekUri = IntervalUri;
type MonthUri = IntervalUri;
type QuarterUri = IntervalUri;
type YearUri = IntervalUri;

export type Instant = {
  "@context": "http://www.w3.org/2006/time";
  "@id"?: InstantUri;
  "@type": "Instant";
  inXSDDateTimeStamp: IsoDate;
};

export type Interval<T extends IntervalUri> = {
  "@context": "http://www.w3.org/2006/time";
  "@id": T;
  intervalMetBy: T;
  intervalMeets: T;
  hasBeginning: InstantUri;
  hasEnd: InstantUri;
};
export type Year = Interval<YearUri> & {
  "@type": "unitYear";
  intervalDuring: [];
  intervalContains: (MonthUri | QuarterUri)[];
};
export type Month = Interval<MonthUri> & {
  "@type": `unitMonth`;
  intervalDuring: Year[];
  intervalContains: (WeekUri | DayUri)[];
};
type WeekContainers =
  | [MonthUri, QuarterUri, YearUri]
  | [QuarterUri, YearUri]
  | [YearUri]
  | [];
export type Week = Interval<WeekUri> & {
  "@type": `unitWeek`;
  intervalDuring: WeekContainers;
  intervalContains: [DayUri, DayUri, DayUri, DayUri, DayUri, DayUri, DayUri];
  intervalOverlappedBy: WeekContainers;
  intervalOverlaps: WeekContainers;
};

export type Day = Interval<DayUri> & {
  "@type": `unitDay`;
  intervalDuring: [WeekUri, MonthUri, QuarterUri, YearUri];
  intervalContains: [];
};

const timeVocabUri = "http://www.w3.org/2006/time";
const gregorianVocabUri = "http://www.w3.org/ns/time/gregorian";
const intervalsIdUri = "http://id.docland.app/intervals/";

export const buildIntervalUri = (path: string): string => intervalsIdUri + path;
export const removeIntervalUriPrefix = (uri: string): string =>
  uri.replace(intervalsIdUri, "");

const instanceUriPrefix = buildIntervalUri("instant/");
const getInstantUri = (date: Date) =>
  `${instanceUriPrefix}${date.toISOString().slice(0, 19)}`;

const yearUriPrefix = buildIntervalUri("year/");
const yearUri = (date: Date): YearUri =>
  `${yearUriPrefix}${date.toISOString().slice(0, 4)}`;

const quarterUriPrefix = buildIntervalUri("quarter/");
const quarter = (date: Date) => {
  return Math.floor(date.getMonth() / 3) + 1;
};
const quarterUri = (date: Date): QuarterUri =>
  `${quarterUriPrefix}${date.toISOString().slice(0, 4)}-Q${quarter(date)}`;

const monthUriPrefix = buildIntervalUri("month/");
const monthUri = (date: Date): MonthUri =>
  `${monthUriPrefix}${date.toISOString().slice(0, 7)}`;

export const dateToWeek = (date: Date): number => {
  date.toISOString();
  const d = new Date(date.getTime());
  d.setUTCDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(Date.UTC(d.getFullYear(), 0, 4));
  // Adjust to Thursday in week 1 and count number of weeks from date to week1.
  // https://en.wikipedia.org/wiki/ISO_week_date#First_week
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
};
export const weekToDate = (year: number, week: number): Date => {
  const getZeroBasedIsoWeekDay = (date: Date) => (date.getDay() + 6) % 7;
  const getIsoWeekDay = (date: Date) => getZeroBasedIsoWeekDay(date) + 1;
  const zeroBasedWeek = week - 1;
  let days = zeroBasedWeek * 7;
  days += 1; // Dates start at 2017-01-01 and not 2017-01-00

  const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
  const firstIsoWeekDay = getIsoWeekDay(firstDayOfYear);
  const zeroBasedFirstIsoWeekDay = getZeroBasedIsoWeekDay(firstDayOfYear);

  // If year begins with W52 or W53
  if (firstIsoWeekDay > 4) {
    days += 8 - firstIsoWeekDay;
    // Else begins with W01
  } else {
    days -= zeroBasedFirstIsoWeekDay;
  }
  return new Date(Date.UTC(year, 0, days));
};
const pad = (number: number, size: number): string => {
  let num = number.toString();
  while (num.length < size) num = "0" + num;
  return num;
};
const weekUriPrefix = buildIntervalUri("week/");
const weekUri = (date: Date): WeekUri => {
  return `${weekUriPrefix}${date.getFullYear()}-W${pad(dateToWeek(date), 2)}`;
};

const dayUriPrefix = buildIntervalUri("day/");
const dayUri = (date: Date): DayUri =>
  `${dayUriPrefix}${date.toISOString().slice(0, 10)}`;

const offsetDay = (day: Date, offset: number): Date => {
  const tomorrow = new Date(day);
  tomorrow.setUTCDate(day.getDate() + offset);
  return tomorrow;
};

const tomorrow = (date: Date): Date => offsetDay(date, 1);
const yesterday = (date: Date): Date => offsetDay(date, -1);

const nextWeek = (date: Date): Date => {
  const tomorrow = new Date(date);
  tomorrow.setUTCDate(date.getDate() + 7);
  return tomorrow;
};

const previousWeek = (date: Date): Date => {
  const yesterday = new Date(date);
  yesterday.setUTCDate(date.getDate() - 7);
  return yesterday;
};

export const monthOfYearName = (uri: string): string | undefined => {
  if (uri.startsWith(gregorianVocabUri)) {
    return uri.replace(gregorianVocabUri + "#", "");
  }
};

const getInstant = (date: Date): Instant => ({
  "@context": "http://www.w3.org/2006/time",
  "@id": getInstantUri(date),
  "@type": "Instant",
  inXSDDateTimeStamp: date.toISOString(),
});
const dateFromInstanceUri = (uri: string): Date =>
  new Date(uri.replace(instanceUriPrefix, "") + "Z");

export const dayType = "unitDay" as const;
const getDayInterval = (startOfDay: Date): Day => ({
  "@context": timeVocabUri,
  "@id": dayUri(startOfDay),
  "@type": dayType,
  intervalMeets: dayUri(tomorrow(startOfDay)),
  intervalMetBy: dayUri(yesterday(startOfDay)),
  hasBeginning: getInstantUri(startOfDay),
  hasEnd: getInstantUri(tomorrow(startOfDay)),
  intervalDuring: [
    weekUri(startOfDay),
    monthUri(startOfDay),
    quarterUri(startOfDay),
    yearUri(startOfDay),
  ],
  intervalContains: [],
});
const dateFromDayUri = (uri: string) =>
  new Date(uri.replace(dayUriPrefix, "") + "Z");

export const weekType = "unitWeek" as const;
const getWeekInterval = (weekDate: Date): Week => {
  let intervalDuring: WeekContainers = [];
  let intervalOverlappedBy: WeekContainers = [];
  let intervalOverlaps: WeekContainers = [];
  const lastDayOfWeek = offsetDay(weekDate, 6);
  if (weekDate.getUTCFullYear() === lastDayOfWeek.getUTCFullYear()) {
    intervalDuring = [yearUri(weekDate)];
  } else {
    intervalOverlappedBy = [yearUri(weekDate)];
    intervalOverlaps = [yearUri(lastDayOfWeek)];
  }
  if (quarter(weekDate) === quarter(lastDayOfWeek)) {
    intervalDuring = [quarterUri(weekDate), ...intervalDuring];
  } else {
    intervalOverlappedBy = [quarterUri(weekDate), ...intervalOverlappedBy];
    intervalOverlaps = [quarterUri(lastDayOfWeek), ...intervalOverlaps];
  }
  if (weekDate.getUTCMonth() === lastDayOfWeek.getUTCMonth()) {
    intervalDuring = [monthUri(weekDate), ...intervalDuring];
  } else {
    intervalOverlappedBy = [monthUri(weekDate), ...intervalOverlappedBy];
    intervalOverlaps = [monthUri(lastDayOfWeek), ...intervalOverlaps];
  }

  return {
    "@context": timeVocabUri,
    "@id": weekUri(weekDate),
    "@type": weekType,
    intervalMeets: weekUri(nextWeek(weekDate)),
    intervalMetBy: weekUri(previousWeek(weekDate)),
    hasBeginning: getInstantUri(weekDate),
    hasEnd: getInstantUri(nextWeek(weekDate)),
    intervalDuring,
    intervalOverlappedBy,
    intervalOverlaps,
    intervalContains: Array.from(Array(7).keys()).map(
      (offset): DayUri => dayUri(offsetDay(weekDate, offset))
    ) as [DayUri, DayUri, DayUri, DayUri, DayUri, DayUri, DayUri],
  };
};
const dateFromWeekUri = (uri: string) => {
  const [year, week] = uri.replace(weekUriPrefix, "").split("-W");
  return weekToDate(parseInt(year), parseInt(week));
};

export const getIntervalData = (uri: string): void | Instant | Day | Week => {
  if (uri.startsWith(instanceUriPrefix)) {
    return getInstant(dateFromInstanceUri(uri));
  } else if (uri.startsWith(dayUriPrefix)) {
    return getDayInterval(dateFromDayUri(uri));
  } else if (uri.startsWith(weekUriPrefix)) {
    return getWeekInterval(dateFromWeekUri(uri));
  }
};

export const intervalBeggingDate = <T extends IntervalUri>(
  interval: Interval<T>
): Date => dateFromInstanceUri(interval.hasBeginning);

export const intervalEndDate = <T extends IntervalUri>(
  interval: Interval<T>
): Date => dateFromInstanceUri(interval.hasEnd);

export const isInstantWithin = <T extends IntervalUri>(
  interval: Interval<T>,
  instant: Date
): boolean => {
  const begging = intervalBeggingDate(interval);
  if (instant < begging) return false;
  const end = intervalEndDate(interval);
  return instant < end;
};

export const getTodayUri = (): DayUri => dayUri(new Date());
