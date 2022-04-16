import type { JsonHtml, UiComponent, View } from "linki-ui";
import {
  a,
  div,
  dom,
  h2,
  h4,
  header,
  mountComponent,
  renderJsonHtmlToDom,
} from "linki-ui";

import type { AnnotationsSubscribe } from "../../functions/indexes/annotations-index";
import type { CompletionSubscribe } from "../../functions/indexes/completion-index";
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
import type { EntityViewControls } from "../app/entity-view";
import { inline, stack } from "../common/spacing";
import { habits } from "../productivity/habits";
import { readOnlyTasks, tasks } from "../productivity/tasks";

import {
  comments,
  readOnlyReviewBody,
  readOnlyReviewRating,
  review,
} from "./comments";

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

const journalHeader: View<CalendarInterval> = (interval) =>
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

const child: View<{
  intervalUri: IntervalUri;
  subscribeAnnotations: AnnotationsSubscribe;
  subscribeCompletable: CompletionSubscribe;
}> = ({ intervalUri, subscribeAnnotations, subscribeCompletable }) => {
  const interval = getIntervalData(intervalUri) as CalendarInterval;

  const reviewRating = mountComponent(
    readOnlyReviewRating(intervalUri, subscribeAnnotations),
    {},
    { parentTag: "span" }
  )[0];

  const reviewBody = mountComponent(
    readOnlyReviewBody(intervalUri, subscribeAnnotations)
  )[0];

  const tasksSlot: JsonHtml =
    interval["@type"] === "unitDay"
      ? mountComponent(
          readOnlyTasks({ subscribe: subscribeCompletable, interval })
        )[0]
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
    reviewBody
  );
};

export const journal = ({
  interval,
  entityViewControls: {
    readAppContext,
    subscribe: {
      annotations: subscribeAnnotations,
      completable: subscribeCompletable,
      habits: subscribeHabits,
    },
    search: { completable: searchCompletable },
    saveLinkedData,
  },
}: {
  interval: CalendarInterval;
  entityViewControls: EntityViewControls;
}): UiComponent => ({ render }) => {
  const intervalUri = interval["@id"];
  const intervalDate = intervalBeggingDate(interval);

  const tasksSlot: JsonHtml =
    interval["@type"] === "unitDay"
      ? mountComponent(
          tasks({
            saveLinkedData,
            subscribe: subscribeCompletable,
            searchCompletable,
            day: interval,
          })
        )[0]
      : undefined;

  const [habitsSlot] = mountComponent(
    habits({ interval, subscribe: subscribeHabits, saveLinkedData })
  );

  const [commentsSlot] = mountComponent(
    comments({
      intervalUri: intervalUri,
      dayDate: intervalDate,
      subscribe: subscribeAnnotations,
      readAppContext,
      saveLinkedData,
    })
  );
  const [reviewSlot] = mountComponent(
    review({
      intervalUri: intervalUri,
      subscribe: subscribeAnnotations,
      readAppContext,
      saveLinkedData,
    })
  );

  const children = [
    ...interval.intervalContains,
    ...(interval["intervalOverlaps"] ?? []),
  ].map((uri) =>
    child({ intervalUri: uri, subscribeAnnotations, subscribeCompletable })
  );

  const container = renderJsonHtmlToDom(
    div(
      { class: "with-line-length-settings my-10" },
      journalHeader(interval),
      stack(
        { gap: "large" },
        commentsSlot,
        habitsSlot,
        tasksSlot,
        ...children,
        reviewSlot
      )
    )
  );
  render(dom(container));
};
