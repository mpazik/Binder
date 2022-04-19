import type { Callback } from "linki";
import { filter, fork, head, identity, ignore, link, map } from "linki";
import type { UiItemComponent, View } from "linki-ui";
import {
  div,
  getTargetInputValue,
  h2,
  h3,
  input,
  isKey,
  isTargetInputChecked,
  li,
  mountItemComponent,
  resetTargetInput,
  span,
  ul,
} from "linki-ui";

import type {
  CalendarInterval,
  Day,
  IntervalUri,
} from "../../libs/calendar-ld";
import {
  intervalBeggingDate,
  intervalEndDate,
  isInstantWithin,
} from "../../libs/calendar-ld";
import { throwIfUndefined } from "../../libs/errors";
import type { HashUri } from "../../libs/hash";
import { splitMap } from "../../libs/linki";
import { createUndo } from "../../vocabulary/activity-streams";
import type { PageControls } from "../app/entity-view";
import { stack } from "../common/spacing";

import type { PageBlock } from "./utils";
import { mountBlock } from "./utils";

export type Task = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Task";
  content: string;
  published: string;
};
export const createTask = (content: string, published = new Date()): Task => ({
  "@context": "http://docland.app/productivity.jsonld",
  "@type": "Task",
  content,
  published: published.toISOString(),
});

export type Complete = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Complete";
  object: HashUri;
  published: string;
};
export const createComplete = (
  objectToComplete: HashUri,
  published = new Date()
): Complete => ({
  "@context": "http://docland.app/productivity.jsonld",
  "@type": "Complete",
  object: objectToComplete,
  published: published.toISOString(),
});

export type Schedule = {
  "@context": "http://docland.app/productivity.jsonld";
  "@type": "Schedule";
  object: HashUri;
  target: IntervalUri;
  published: string;
};
const completionCreator = (completionDay: Day) => (taskId: HashUri) =>
  createComplete(taskId, completionDate(completionDay));

const taskView = ({
  onChange,
}: {
  onChange?: Callback<Event>;
}): View<{ completed: boolean; content: string }> => ({ completed, content }) =>
  li(
    { class: "pb-1" },
    input({
      class: "mr-1 v-align-middle",
      style: { width: "0.9em", height: "0.9em" },
      type: "checkbox",
      checked: completed,
      disabled: !onChange,
      ...(onChange ? { onChange } : {}),
    }),
    span(
      completed
        ? {
            class: "color-text-secondary",
            style: {
              textDecoration: "line-through",
            },
          }
        : {},
      content
    )
  );
export type TaskUri = HashUri;
export type TaskObject = {
  id: TaskUri;
  content: string;
} & ({ completed: false } | { completed: true; completionTime: Date });
const readOnlyTaskComponent: UiItemComponent<TaskObject> = ({ render }) => {
  return {
    updateItem: link(map(taskView({})), render),
  };
};
const taskComponent: UiItemComponent<
  TaskObject,
  { onCompleted: void; onUndone: void }
> = ({ render, onCompleted, onUndone }) => {
  return {
    updateItem: link(
      map(
        taskView({
          onChange: link(
            map(isTargetInputChecked),
            splitMap(identity(), ignore),
            [onCompleted, onUndone]
          ),
        })
      ),
      render
    ),
  };
};
const taskInput: View<{ onSubmit: Callback<string> }> = ({ onSubmit }) =>
  input({
    type: "text",
    class: "my-1",
    size: 30,
    style: { height: "2.2em" },
    placeholder: "New task",
    onKeyDown: link(
      filter(isKey("Enter")),
      fork(link(map(getTargetInputValue), onSubmit), resetTargetInput)
    ),
  });
const getId = (it: TaskObject): HashUri => it.id;
const completionDate = (completionDay: Day) => {
  const today = new Date();
  return isInstantWithin(completionDay, today)
    ? today
    : intervalBeggingDate(completionDay);
};

export const tasksBlock: PageBlock<Day> = (
  {
    saveLinkedData,
    search: { completable: searchCompletable },
    subscribe: { completable: subscribe },
  }: PageControls,
  day: Day
) =>
  mountBlock(({ render }) => {
    const createTaskList = () =>
      mountItemComponent(getId, taskComponent, {
        onCompleted: link(map(head(), completionCreator(day)), saveLinkedData),
        onUndone: async ([id]) => {
          const record = throwIfUndefined(await searchCompletable(id));
          if (record.completed === 0)
            throw new Error("can not undo not completed record");
          saveLinkedData(createUndo(record.eventId));
        },
      });

    const [todoTasks, { changeItems: changeTodoTasks }] = createTaskList();
    const [
      completedTasks,
      { changeItems: changeCompletedTasks },
    ] = createTaskList();

    render(
      stack(
        { gap: "medium" },
        h2("Tasks"),
        div(
          h3({ class: "h4" }, "Completed that day"),
          ul({ class: "list-style-none" }, completedTasks)
        ),
        div(
          h3({ class: "h4" }, "To do"),
          ul({ class: "list-style-none" }, todoTasks),
          taskInput({ onSubmit: link(map(createTask), saveLinkedData) })
        )
      )
    );

    return {
      stop: fork(
        link(
          subscribe({
            completed: false,
          }),
          changeTodoTasks
        ),
        link(
          subscribe({
            since: intervalBeggingDate(day).getTime(),
            until: intervalEndDate(day).getTime(),
          }),
          changeCompletedTasks
        )
      ),
    };
  });

export const readOnlyTasksBlock: PageBlock<CalendarInterval> = (
  { subscribe: { completable: subscribe } },
  interval
) =>
  mountBlock(({ render }) => {
    const [tasks, { changeItems }] = mountItemComponent(
      getId,
      readOnlyTaskComponent,
      {}
    );

    render(ul({ class: "list-style-none" }, tasks));
    return {
      stop: link(
        subscribe({
          since: intervalBeggingDate(interval).getTime(),
          until: intervalEndDate(interval).getTime(),
        }),
        changeItems
      ),
    };
  });
