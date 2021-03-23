// in miliseconds

import RelativeTimeFormatUnit = Intl.RelativeTimeFormatUnit;

const units: [RelativeTimeFormatUnit, number][] = [
  ["year", 24 * 60 * 60 * 1000 * 365],
  ["month", (24 * 60 * 60 * 1000 * 365) / 12],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
  ["second", 1000],
];

const relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});
export const formatRelativeTime = (dateA: Date, dateB = new Date()): string => {
  const elapsed = dateA.getTime() - dateB.getTime();

  for (const [unit, value] of units)
    if (Math.abs(elapsed) > value)
      return relativeTimeFormat.format(Math.round(elapsed / value), unit);

  return relativeTimeFormat.format(Math.round(elapsed / 1000), "second");
};

export const formatDateTime = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format;
