import "./style.css";

import type { Callback } from "linki";
import { link, map } from "linki";
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
  th,
  thead,
  tr,
} from "linki-ui";

import type { CalendarInterval, IntervalUri } from "../../../libs/calendar-ld";
import { dayType, weekType } from "../../../libs/calendar-ld";
import type { HashUri } from "../../../libs/hash";
import { stack } from "../../common/spacing";
import type { PageBlock } from "../../system/page";
import { mountBlock } from "../../system/page";

import type {
  HabitObject,
  HabitTrackEventObject,
  HabitTrackStatusUri,
} from "./model";
import { createHabitTrackEvent, habitTrackStatuses } from "./model";

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
): UiItemComponent<HabitObject, { onTrack: HabitTrackEventObject }> => ({
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

export const habitsBlock: PageBlock<CalendarInterval> = (
  { subscribe: { habits: subscribe }, saveLinkedData },
  interval
) =>
  mountBlock(({ render }) => {
    const intervalType = interval["@type"];
    if (intervalType !== weekType && intervalType !== dayType) {
      return;
    }
    const [intervals, headers]: [IntervalUri[], string[]] =
      intervalType === dayType
        ? [
            [interval.intervalMetBy, interval["@id"]],
            ["Yesterday", "Today"],
          ]
        : intervalType === weekType
        ? [
            interval.intervalContains,
            [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ],
          ]
        : [[], []];

    const [habits, { changeItems }] = mountItemComponent(
      getId,
      habitComponent(intervals),
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
            thead(
              tr(
                th("habit"),
                headers.map((it) => th(it))
              )
            ),
            habits
          )
        )
      )
    );
    return {
      stop: link(subscribe({ intervals: intervals }), changeItems),
    };
  });
