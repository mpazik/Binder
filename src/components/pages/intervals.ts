import { div } from "linki-ui";

import type { Day, Month, Week, Year } from "../../libs/calendar-ld";
import { stack } from "../common/spacing";
import { commentsBlock } from "../view-blocks/comments";
import { habitsBlock } from "../view-blocks/habits";
import { intervalChildren, intervalNavigation } from "../view-blocks/interval";
import { reviewBlock } from "../view-blocks/review";
import { tasksBlock } from "../view-blocks/tasks";

import type { PageView } from "./utils";

export const dailyJournal: PageView<Day> = (controls, interval) => {
  const intervalUri = interval["@id"];

  return div(
    { class: "with-line-length-settings my-10" },
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

export const weeklyJournal: PageView<Week> = (controls, interval) => {
  const intervalUri = interval["@id"];

  return div(
    { class: "with-line-length-settings my-10" },
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

export const monthlyJournal: PageView<Month> = (controls, interval) => {
  const intervalUri = interval["@id"];

  return div(
    { class: "with-line-length-settings my-10" },
    intervalNavigation(controls, interval),
    stack(
      { gap: "large" },
      commentsBlock(controls, intervalUri),
      intervalChildren(controls, interval),
      reviewBlock(controls, intervalUri)
    )
  );
};

export const annualJournal: PageView<Year> = (controls, interval) => {
  const intervalUri = interval["@id"];

  return div(
    { class: "with-line-length-settings my-10" },
    intervalNavigation(controls, interval),
    stack(
      { gap: "large" },
      commentsBlock(controls, intervalUri),
      intervalChildren(controls, interval),
      reviewBlock(controls, intervalUri)
    )
  );
};
