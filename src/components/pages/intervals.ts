import { div } from "linki-ui";

import type { CalendarInterval, Day } from "../../libs/calendar-ld";
import { stack } from "../common/spacing";
import type { PageView } from "../system/page";
import { commentsBlock } from "../view-blocks/comments";
import { habitsBlock } from "../view-blocks/habits";
import { intervalChildren, intervalNavigation } from "../view-blocks/interval";
import { reviewBlock } from "../view-blocks/review";
import { tasksBlock } from "../view-blocks/tasks";

export const dailyJournal: PageView = (controls, linkedData) => {
  const interval = linkedData as Day;
  const intervalUri = interval["@id"];

  return div(
    intervalNavigation(controls, interval),
    stack(
      { gap: "large" },
      commentsBlock(controls, intervalUri),
      habitsBlock(controls, interval),
      tasksBlock(controls, interval),
      intervalChildren(controls, interval),
      reviewBlock(controls, intervalUri)
    )
  );
};

export const weeklyJournal: PageView = (controls, linkedData) => {
  const interval = linkedData as CalendarInterval;
  const intervalUri = interval["@id"];

  return div(
    intervalNavigation(controls, interval),
    stack(
      { gap: "large" },
      commentsBlock(controls, intervalUri),
      habitsBlock(controls, interval),
      intervalChildren(controls, interval),
      reviewBlock(controls, intervalUri)
    )
  );
};

export const monthlyJournal: PageView = (controls, linkedData) => {
  const interval = linkedData as CalendarInterval;
  const intervalUri = interval["@id"];

  return div(
    intervalNavigation(controls, interval),
    stack(
      { gap: "large" },
      commentsBlock(controls, intervalUri),
      intervalChildren(controls, interval),
      reviewBlock(controls, intervalUri)
    )
  );
};

export const annualJournal: PageView = (controls, linkedData) => {
  const interval = linkedData as CalendarInterval;
  const intervalUri = interval["@id"];

  return div(
    intervalNavigation(controls, interval),
    stack(
      { gap: "large" },
      commentsBlock(controls, intervalUri),
      intervalChildren(controls, interval),
      reviewBlock(controls, intervalUri)
    )
  );
};
