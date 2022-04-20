import type { JsonHtml, View } from "linki-ui";
import { a, div, h2, h4, header } from "linki-ui";

import type { CalendarInterval, IntervalUri } from "../../libs/calendar-ld";
import {
  dateToWeek,
  dayType,
  getIntervalData,
  intervalBeggingDate,
  intervalTypeName,
  intervalTypeParent,
  monthType,
  weekType,
  yearType,
} from "../../libs/calendar-ld";
import { inline, stack } from "../common/spacing";
import type { PageBlock } from "../system/page";

import { readOnlyReviewRating } from "./rating";
import { readOnlyReviewBody } from "./review";
import { readOnlyTasksBlock } from "./tasks";

const formatYear = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  timeZone: "UTC",
}).format;
const intervalFormats = {
  [dayType]: new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeZone: "UTC",
  }).format,
  [weekType]: (date: Date) => `Week ${dateToWeek(date)} of ${formatYear(date)}`,
  [monthType]: new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format,
  [yearType]: formatYear,
};
const linkToParentDate: View<CalendarInterval> = (
  interval: CalendarInterval
) => {
  if (interval["@type"] === yearType) return;
  const parentName = intervalTypeName[intervalTypeParent[interval["@type"]]];
  const parentUri =
    interval.intervalDuring.find((it) => it.includes(parentName)) ??
    (interval.intervalOverlappedBy ?? []).find((it) => it.includes(parentName));
  if (!parentUri) return;
  return a(
    {
      href: parentUri,
    },
    parentName
  );
};

const intervalName = (interval: CalendarInterval) =>
  intervalFormats[interval["@type"]](intervalBeggingDate(interval));

export const intervalNavigation: PageBlock<CalendarInterval> = (
  controls,
  interval
) =>
  header(
    { class: "text-center" },
    h2(intervalName(interval)),
    inline(
      { class: "flex-justify-center" },
      a(
        {
          href: interval.intervalMetBy,
        },
        "← previous"
      ),
      linkToParentDate(interval),
      a(
        {
          href: interval.intervalMeets,
        },
        "next →"
      )
    )
  );

const intervalChild: PageBlock<IntervalUri> = (controls, intervalUri) => {
  const interval = getIntervalData(intervalUri) as CalendarInterval;

  const reviewRating = readOnlyReviewRating(controls, intervalUri);

  const tasksSlot: JsonHtml =
    interval["@type"] === "unitDay"
      ? readOnlyTasksBlock(controls, interval)
      : undefined;

  return div(
    h4(
      a(
        {
          class: "Link--primary",
          href: intervalUri,
        },
        intervalName(interval)
      ),
      reviewRating
    ),
    tasksSlot,
    readOnlyReviewBody(controls, intervalUri)
  );
};

export const intervalChildren: PageBlock<CalendarInterval> = (
  controls,
  interval
) => {
  const children = [
    ...interval.intervalContains,
    ...(interval["intervalOverlaps"] ?? []),
  ].map((uri) => intervalChild(controls, uri));
  return children.length ? stack(...children) : undefined;
};
