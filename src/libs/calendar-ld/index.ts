import type { Uri } from "../browser-providers";

type IsoDate = string;
type InstantUri = Uri;
export type IntervalUri = Uri;
export type DayUri = IntervalUri;
export type WeekUri = IntervalUri;
export type MonthUri = IntervalUri;
export type YearUri = IntervalUri;

const timeVocabUri = "http://www.w3.org/2006/time";
const gregorianVocabUri = "http://www.w3.org/ns/time/gregorian";
const intervalsIdUri = "http://id.docland.app/intervals/";
export const dayType = "unitDay" as const;
export const weekType = "unitWeek" as const;
export const monthType = "unitMonth" as const;
export const yearType = "unitYear" as const;
export const intervalTypes = [dayType, weekType, monthType, yearType];
export type IntervalTypes = typeof intervalTypes[number];
export const intervalTypeParent = {
  [dayType]: weekType,
  [weekType]: monthType,
  [monthType]: yearType,
};
export const intervalTypeChildren = {
  [weekType]: dayType,
  [monthType]: weekType,
  [yearType]: monthType,
};
export const intervalTypeName = {
  [dayType]: "day",
  [weekType]: "week",
  [monthType]: "month",
  [yearType]: "year",
};

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
  intervalOverlappedBy?: InstantUri[];
  intervalOverlaps?: InstantUri[];
};
export type Day = Interval<DayUri> & {
  "@type": `unitDay`;
  intervalDuring: [WeekUri, MonthUri, YearUri];
  intervalContains: [];
};
type WeekContainers = [MonthUri, YearUri] | [YearUri] | [];
export type Week = Interval<WeekUri> & {
  "@type": `unitWeek`;
  intervalDuring: WeekContainers;
  intervalContains: [DayUri, DayUri, DayUri, DayUri, DayUri, DayUri, DayUri];
  intervalOverlappedBy: WeekContainers;
  intervalOverlaps: WeekContainers;
};
export type Month = Interval<MonthUri> & {
  "@type": `unitMonth`;
  intervalDuring: [YearUri];
  intervalContains: WeekUri[];
  intervalOverlappedBy: [WeekUri] | [];
  intervalOverlaps: [WeekUri] | [];
};
export type Year = Interval<YearUri> & {
  "@type": "unitYear";
  intervalDuring: [];
  intervalContains: MonthUri[];
};
export type CalendarInterval = Day | Week | Month | Year;

export const buildIntervalUri = (path: string): string => intervalsIdUri + path;
export const removeIntervalUriPrefix = (uri: string): string =>
  uri.replace(intervalsIdUri, "");

const instanceUriPrefix = buildIntervalUri("instant/");
const getInstantUri = (date: Date) =>
  `${instanceUriPrefix}${date.toISOString().slice(0, 19)}`;

const yearUriPrefix = buildIntervalUri("year/");
const yearUri = (date: Date): YearUri =>
  `${yearUriPrefix}${date.toISOString().slice(0, 4)}`;

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
const weekUriRaw = (year: number, week: number): WeekUri =>
  `${weekUriPrefix}${year}-W${pad(week, 2)}`;
const weekUri = (date: Date): WeekUri =>
  weekUriRaw(date.getUTCFullYear(), dateToWeek(date));

const dayUriPrefix = buildIntervalUri("day/");
const dayUri = (date: Date): DayUri =>
  `${dayUriPrefix}${date.toISOString().slice(0, 10)}`;

const offsetDay = (date: Date, offset: number): Date => {
  const moved = new Date(date);
  moved.setUTCDate(date.getUTCDate() + offset);
  return moved;
};
const offsetMonth = (date: Date, offset: number): Date => {
  const moved = new Date(date);
  moved.setUTCMonth(date.getUTCMonth() + offset);
  return moved;
};
const offsetYear = (date: Date, offset: number): Date => {
  const moved = new Date(date);
  moved.setUTCFullYear(date.getUTCFullYear() + offset);
  return moved;
};

const tomorrow = (date: Date): Date => offsetDay(date, 1);
const yesterday = (date: Date): Date => offsetDay(date, -1);

const nextWeek = (date: Date): Date => offsetDay(date, 7);
const previousWeek = (date: Date): Date => offsetDay(date, -7);
const lastDayOfWeek = (date: Date): Date => offsetDay(date, 6);

const nextMonth = (date: Date): Date => offsetMonth(date, 1);
const previousMonth = (date: Date): Date => offsetMonth(date, -1);
const lastDayOfMonth = (date: Date): Date =>
  offsetDay(offsetMonth(date, 1), -1);

const nextYear = (date: Date): Date => offsetYear(date, 1);
const previousYear = (date: Date): Date => offsetYear(date, -1);

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
    yearUri(startOfDay),
  ],
  intervalContains: [],
});
const dateFromDayUri = (uri: string) =>
  new Date(uri.replace(dayUriPrefix, "") + "Z");

const getWeekInterval = (weekDate: Date): Week => {
  let intervalDuring: WeekContainers = [];
  let intervalOverlappedBy: WeekContainers = [];
  let intervalOverlaps: WeekContainers = [];
  const lastDay = lastDayOfWeek(weekDate);
  if (weekDate.getUTCFullYear() === lastDay.getUTCFullYear()) {
    intervalDuring = [yearUri(weekDate)];
  } else {
    intervalOverlappedBy = [yearUri(weekDate)];
    intervalOverlaps = [yearUri(lastDay)];
  }
  if (weekDate.getUTCMonth() === lastDay.getUTCMonth()) {
    intervalDuring = [monthUri(weekDate), ...intervalDuring];
  } else {
    intervalOverlappedBy = [monthUri(weekDate), ...intervalOverlappedBy];
    intervalOverlaps = [monthUri(lastDay), ...intervalOverlaps];
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
    intervalContains: range(0, 6).map(
      (offset): DayUri => dayUri(offsetDay(weekDate, offset))
    ) as [DayUri, DayUri, DayUri, DayUri, DayUri, DayUri, DayUri],
  };
};
const dateFromWeekUri = (uri: string) => {
  const [year, week] = uri.replace(weekUriPrefix, "").split("-W");
  return weekToDate(parseInt(year), parseInt(week));
};
const range = (from: number, to: number): number[] =>
  Array.from({ length: to + 1 - from }, (_, i) => from + i);

const getMonthInterval = (monthDate: Date): Month => {
  const lastDay = lastDayOfMonth(monthDate);
  const firstWeek = dateToWeek(monthDate);
  const lastWeek = dateToWeek(lastDay);
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  const firstWeekInPastYear = firstWeek > lastWeek;
  const firstDayOfFirstWeek = weekToDate(
    firstWeekInPastYear ? year - 1 : year,
    firstWeek
  );
  const lastDayOfLastWeek = lastDayOfWeek(
    weekToDate(lastDay.getUTCFullYear(), lastWeek)
  );
  return {
    "@context": timeVocabUri,
    "@id": monthUri(monthDate),
    "@type": monthType,
    intervalMeets: monthUri(nextMonth(monthDate)),
    intervalMetBy: monthUri(previousMonth(monthDate)),
    hasBeginning: getInstantUri(monthDate),
    hasEnd: getInstantUri(nextMonth(monthDate)),
    intervalDuring: [yearUri(monthDate)],
    intervalOverlappedBy:
      firstDayOfFirstWeek.getUTCMonth() === month
        ? []
        : [weekUri(firstDayOfFirstWeek)],
    intervalOverlaps:
      lastDayOfLastWeek.getUTCMonth() === month
        ? []
        : [weekUri(lastDayOfLastWeek)],
    intervalContains: [
      ...(firstDayOfFirstWeek.getUTCMonth() === month
        ? [weekUriRaw(year, firstWeek)]
        : []),
      ...(firstWeekInPastYear
        ? range(1, lastWeek - 1)
        : range(firstWeek + 1, lastWeek - 1)
      ).map((week): WeekUri => weekUriRaw(year, week)),
      ...(lastDayOfLastWeek.getUTCMonth() === month
        ? [weekUriRaw(year, lastWeek)]
        : []),
    ],
  };
};
const dateFromMonthUri = (uri: string) =>
  new Date(uri.replace(monthUriPrefix, "") + "Z");

const getYearInterval = (yearDate: Date): Year => {
  return {
    "@context": timeVocabUri,
    "@id": yearUri(yearDate),
    "@type": yearType,
    intervalDuring: [],
    intervalMeets: yearUri(nextYear(yearDate)),
    intervalMetBy: yearUri(previousYear(yearDate)),
    hasBeginning: getInstantUri(yearDate),
    hasEnd: getInstantUri(nextYear(yearDate)),
    intervalContains: Array.from(Array(12).keys()).map(
      (offset): DayUri => monthUri(offsetMonth(yearDate, offset))
    ),
  };
};
const dateFromYearUri = (uri: string) =>
  new Date(uri.replace(yearUriPrefix, "") + "Z");

export const getIntervalData = (
  uri: string
): void | Instant | Day | Week | Month | Year => {
  if (uri.startsWith(instanceUriPrefix)) {
    return getInstant(dateFromInstanceUri(uri));
  } else if (uri.startsWith(dayUriPrefix)) {
    return getDayInterval(dateFromDayUri(uri));
  } else if (uri.startsWith(weekUriPrefix)) {
    return getWeekInterval(dateFromWeekUri(uri));
  } else if (uri.startsWith(monthUriPrefix)) {
    return getMonthInterval(dateFromMonthUri(uri));
  } else if (uri.startsWith(yearUriPrefix)) {
    return getYearInterval(dateFromYearUri(uri));
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
