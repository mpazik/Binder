import { div, span } from "../../../../linki-ui";
import type { LinkedDataWithHashId } from "../../libs/jsonld-format";
import { getHash } from "../../libs/linked-data";
import type { Habit } from "../../vocabulary/productivity/habits";
import type { PageView } from "../system/page";
import { commentsBlock } from "../view-blocks/comments";

export const habitPage: PageView = (controls, linkedData) => {
  const reference = getHash(linkedData as LinkedDataWithHashId);
  const habit = linkedData as Habit;

  return div(
    div(
      { class: "Subhead" },
      div(
        { class: "Subhead-heading" },
        span({ class: "f1" }, habit.emojiIcon),
        habit.title
      )
    ),
    commentsBlock(controls, reference)
  );
};
