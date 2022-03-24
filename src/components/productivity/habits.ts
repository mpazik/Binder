import type { Callback } from "linki";
import { arrayChanger, link, logger, map, reduce } from "linki";
import type { UiItemComponent, View } from "linki-ui";
import {
  div,
  getTargetInputValue,
  h2,
  mountItemComponent,
  option,
  select,
  span,
  table,
  td,
  tr,
} from "linki-ui";

import type { HabitSubscribeIndex } from "../../functions/indexes/habit-index";
import type { Day, IntervalUri } from "../../libs/calendar-ld";
import type { HashUri } from "../../libs/hash";
import type { LinkedData } from "../../libs/jsonld-format";
import { stack } from "../common/spacing";

import type {
  HabitObject,
  HabitTrackStatusUri,
  HabitTrackEventObject,
} from "./model";
import { habitTrackStatuses } from "./model";
import { createHabitTrackEvent } from "./vocabulary";

const habitTrackStatusSelect: View<{
  selected?: HabitTrackStatusUri;
  onChange: Callback<HabitTrackStatusUri>;
}> = ({ selected, onChange }) =>
  select(
    {
      class: "f1",
      style: { fontFamily: "serif", border: "none" },
      onChange: link(map(getTargetInputValue), onChange),
    },
    option({ title: `not tracked` }, "➖"),
    ...Object.values(habitTrackStatuses).map(
      ({ title, emojiIcon, description, uri }) =>
        option(
          {
            title: `${title} - ${description}`,
            value: uri,
            selected: uri === selected,
          },
          emojiIcon
        )
    )
  );

const habitComponent = (
  intervals: IntervalUri[]
): UiItemComponent<HabitObject, {}, { onTrack: HabitTrackEventObject }> => ({
  render,
  onTrack,
}) => {
  return {
    updateItem: ({ id, title, emojiIcon, description, trackEvents }) => {
      render(
        tr(
          { dataSet: { id } },
          td(
            div(
              { class: "d-flex flex-items-center", title: description },
              span({ class: "f1" }, emojiIcon),
              title
            )
          ),
          ...intervals.map((interval) => {
            const event = trackEvents.find((it) => it.interval === interval);
            return td(
              habitTrackStatusSelect({
                selected: event?.status,
                onChange: link(
                  map((status) => ({
                    status,
                    interval,
                  })),
                  onTrack
                ),
              })
            );
          })
        )
      );
    },
  };
};

const getId = (it: HabitObject): HashUri => it.id;

export const habitsView: View<{
  subscribe: HabitSubscribeIndex;
  saveLinkedData: Callback<LinkedData>;
  day: Day;
}> = ({ day, subscribe, saveLinkedData }) => {
  const [habits, { updateItems }] = mountItemComponent(
    getId,
    habitComponent([day["@id"]]),
    {
      onTrack: link(
        map(([habit, { status, interval }]) =>
          createHabitTrackEvent(habit, interval, status)
        ),
        saveLinkedData
      ),
    }
  );

  link(
    subscribe,
    logger("d"),
    reduce(arrayChanger(getId), []),
    updateItems
  )({ intervals: [day["@id"]] });

  return stack(
    { gap: "medium" },
    h2("Habits"),
    div({ class: "markdown-body" }, table(habits))
  );
};
