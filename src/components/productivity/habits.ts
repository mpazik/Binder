import "./style.css";

import type { Callback } from "linki";
import { arrayChanger, link, map, reduce } from "linki";
import type { UiComponent, UiItemComponent, View } from "linki-ui";
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
  th,
  thead,
  tr,
} from "linki-ui";

import type { HabitSubscribe } from "../../functions/indexes/habit-index";
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
      class: "f2",
      onChange: link(map(getTargetInputValue), onChange),
    },
    ...(selected ? [] : [option({ title: `not tracked` }, "➖")]),
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
    updateItem: ({ title, emojiIcon, description, trackEvents }) => {
      render([
        td(
          div(
            { class: "d-flex flex-items-center", title: description },
            span({ class: "f2" }, emojiIcon),
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
        }),
      ]);
    },
  };
};

const getId = (it: HabitObject): HashUri => it.id;

export const habits = ({
  day,
  subscribe,
  saveLinkedData,
}: {
  subscribe: HabitSubscribe;
  saveLinkedData: Callback<LinkedData>;
  day: Day;
}): UiComponent => ({ render }) => {
  const [habits, { updateItems }] = mountItemComponent(
    getId,
    habitComponent([day.intervalMetBy, day["@id"]]),
    {
      onTrack: link(
        map(([habit, { status, interval }]) =>
          createHabitTrackEvent(habit, interval, status)
        ),
        saveLinkedData
      ),
    },
    {
      parentTag: "tbody",
      childrenElementFactory: (id) => {
        const child = document.createElement("tr");
        child.setAttribute("data-set", id);
        return child;
      },
    }
  );

  render(
    stack(
      { gap: "medium" },
      h2("Habits"),
      div(
        { class: "markdown-body" },
        table(
          { class: "habits" },
          thead(tr(th("habit"), th("yesterday"), th("today"))),
          habits
        )
      )
    )
  );
  return {
    stop: link(
      subscribe({ intervals: [day["@id"]] }),
      reduce(arrayChanger(getId), []),
      updateItems
    ),
  };
};
