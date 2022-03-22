type IsoDate = string;
type Uri = string;
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
  "@type": "http://reference.data.gov.uk/def/intervals/Year";
  intervalDuring: [];
  intervalContains: (MonthUri | QuarterUri)[];
};
export type Quarter = Interval<QuarterUri> & {
  "@type": "http://reference.data.gov.uk/def/intervals/Quarter";
  intervalDuring: [YearUri];
  intervalContains: [];
};
export type Month = Interval<MonthUri> & {
  "@type": "http://reference.data.gov.uk/def/intervals/Month";
  intervalDuring: (Quarter | Year)[];
  intervalContains: (WeekUri | DayUri)[];
  monthOfYear: string;
};
export type Week = Interval<WeekUri> & {
  intervalDuring: [Month];
  intervalContains: DayUri[];
  week: number;
};

export type Day = Interval<DayUri> & {
  "@type": `unitDay`;
  intervalDuring: (WeekUri | MonthUri | QuarterUri | YearUri)[];
  intervalContains: [];
  dayOfWeek: Uri;
  monthOfYear: Uri;
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

const weekUriPrefix = buildIntervalUri("week/");
const week = (date: Date): number => {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  // Adjust to Thursday in week 1 and count number of weeks from date to week1.
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
const weekUri = (date: Date): WeekUri =>
  `${weekUriPrefix}${date.getFullYear()}-W${week(date)}`;

const dayUriPrefix = buildIntervalUri("day/");
const dayUri = (date: Date): DayUri =>
  `${dayUriPrefix}${date.toISOString().slice(0, 10)}`;

const tomorrow = (date: Date): Date => {
  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);
  return tomorrow;
};

const yesterday = (date: Date): Date => {
  const yesterday = new Date(date);
  yesterday.setDate(date.getDate() - 1);
  return yesterday;
};

const dayOfWeeks = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const dayOfWeekUri = (date: Date): Uri =>
  `${timeVocabUri}#${dayOfWeeks[date.getDay()]}`;

export const dayOfWeekName = (uri: string): string | undefined => {
  if (uri.startsWith(timeVocabUri)) {
    return uri.replace(timeVocabUri + "#", "");
  }
};

const monthOfYear = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const monthOfYearUri = (date: Date): Uri => {
  return `${gregorianVocabUri}#${monthOfYear[date.getMonth()]}`;
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

export const dayType: "unitDay" = `unitDay`;
const getDayInterval = (date: Date): Day => ({
  "@context": "http://www.w3.org/2006/time",
  "@id": dayUri(date),
  "@type": dayType,
  intervalMeets: dayUri(tomorrow(date)),
  intervalMetBy: dayUri(yesterday(date)),
  hasBeginning: getInstantUri(date),
  hasEnd: getInstantUri(tomorrow(date)),
  intervalDuring: [
    weekUri(date),
    monthUri(date),
    quarterUri(date),
    yearUri(date),
  ],
  intervalContains: [],
  dayOfWeek: dayOfWeekUri(date),
  monthOfYear: monthOfYearUri(date),
});
const dateFromDayUri = (uri: string) =>
  new Date(uri.replace(dayUriPrefix, "") + "Z");

export const getIntervalData = (uri: string): Day | Instant | void => {
  if (uri.startsWith(dayUriPrefix)) {
    return getDayInterval(dateFromDayUri(uri));
  } else if (uri.startsWith(instanceUriPrefix)) {
    return getInstant(dateFromInstanceUri(uri));
  }
};
