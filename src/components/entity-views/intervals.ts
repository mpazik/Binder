import { div } from "linki-ui";

import type { Day, Month, Week, Year } from "../../libs/calendar-ld";
import { stack } from "../common/spacing";
import { commentsBlock } from "../view-blocks/comments";
import { habitsBlock } from "../view-blocks/habits";
import { intervalChildren, intervalNavigation } from "../view-blocks/interval";
import { reviewBlock } from "../view-blocks/review";
import { tasksBlock } from "../view-blocks/tasks";

import type { EntityView } from "./utils";

export const dailyJournal: EntityView<Day> = (interval, controls) => {
  const intervalUri = interval["@id"];

  return div(
    { class: "with-line-length-settings my-10" },
    intervalNavigation(interval, controls),
    stack(
      { gap: "large" },
      commentsBlock(intervalUri, controls),
      habitsBlock(interval, controls),
      tasksBlock(interval, controls),
      intervalChildren(interval, controls),
      reviewBlock(intervalUri, controls)
    )
  );
};

export const weeklyJournal: EntityView<Week> = (interval, controls) => {
  const intervalUri = interval["@id"];

  return div(
    { class: "with-line-length-settings my-10" },
    intervalNavigation(interval, controls),
    stack(
      { gap: "large" },
      commentsBlock(intervalUri, controls),
      habitsBlock(interval, controls),
      intervalChildren(interval, controls),
      reviewBlock(intervalUri, controls)
    )
  );
};

export const monthlyJournal: EntityView<Month> = (interval, controls) => {
  const intervalUri = interval["@id"];

  return div(
    { class: "with-line-length-settings my-10" },
    intervalNavigation(interval, controls),
    stack(
      { gap: "large" },
      commentsBlock(intervalUri, controls),
      intervalChildren(interval, controls),
      reviewBlock(intervalUri, controls)
    )
  );
};

export const annualJournal: EntityView<Year> = (interval, controls) => {
  const intervalUri = interval["@id"];

  return div(
    { class: "with-line-length-settings my-10" },
    intervalNavigation(interval, controls),
    stack(
      { gap: "large" },
      commentsBlock(intervalUri, controls),
      intervalChildren(interval, controls),
      reviewBlock(intervalUri, controls)
    )
  );
};
