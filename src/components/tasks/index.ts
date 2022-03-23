import type { Callback } from "linki";
import {
  arrayChanger,
  filter,
  fork,
  head,
  identity,
  ignore,
  link,
  map,
  reduce,
} from "linki";
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
  CompletionSubscribeIndex,
  SearchCompletionIndex,
} from "../../functions/indexes/completion-index";
import type { Day } from "../../libs/calendar-ld";
import {
  intervalBeggingDate,
  intervalEndDate,
  isInstantWithin,
} from "../../libs/calendar-ld";
import { throwIfUndefined } from "../../libs/errors";
import type { HashUri } from "../../libs/hash";
import type { LinkedData } from "../../libs/jsonld-format";
import { splitMap } from "../../libs/linki";
import { stack } from "../common/spacing";

import type { TaskObject } from "./model";
import {
  createComplete,
  createTask,
  createUndo,
} from "./productivity-vocabulary";

const taskComponent: UiItemComponent<
  TaskObject,
  {},
  { onCompleted: void; onUndone: void }
> = ({ render, onCompleted, onUndone }) => {
  return {
    updateItem: ({ completed, content }) => {
      render(
        li(
          { class: "f3-light pb-1" },
          input({
            class: "mr-1 v-align-middle",
            style: { width: "0.9em", height: "0.9em" },
            type: "checkbox",
            checked: completed,
            onChange: link(
              map(isTargetInputChecked),
              splitMap(identity(), ignore),
              [onCompleted, onUndone]
            ),
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
        )
      );
    },
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
const completionCreator = (completionDay: Day) => (taskId: HashUri) =>
  createComplete(taskId, completionDate(completionDay));

export const tasksView: View<{
  subscribe: CompletionSubscribeIndex;
  saveLinkedData: Callback<LinkedData>;
  completionDay: Day;
  searchCompletionIndex: SearchCompletionIndex;
}> = ({ subscribe, saveLinkedData, completionDay, searchCompletionIndex }) => {
  const createTaskList = () =>
    mountItemComponent(getId, taskComponent, {
      onCompleted: link(
        map(head(), completionCreator(completionDay)),
        saveLinkedData
      ),
      onUndone: async ([id]) => {
        const record = throwIfUndefined(await searchCompletionIndex(id));
        if (record.completed === 0)
          throw new Error("can not undo not completed record");
        saveLinkedData(createUndo(record.eventId));
      },
    });

  const [todoTasks, { updateItems: updateTodoTasks }] = createTaskList();
  const [
    completedTasks,
    { updateItems: updateCompletedTasks },
  ] = createTaskList();

  link(
    subscribe,
    reduce(arrayChanger(getId), []),
    updateTodoTasks
  )({
    completed: false,
  });

  link(
    subscribe,
    reduce(arrayChanger(getId), []),
    updateCompletedTasks
  )({
    since: intervalBeggingDate(completionDay).getTime(),
    until: intervalEndDate(completionDay).getTime(),
  });

  return stack(
    { gap: "large" },
    h2("Tasks"),
    div(
      h3({ class: "h4" }, "To do"),
      ul({ class: "list-style-none" }, todoTasks),
      taskInput({ onSubmit: link(map(createTask), saveLinkedData) })
    ),
    div(
      h3({ class: "h4" }, "Completed that day"),
      ul({ class: "list-style-none" }, completedTasks)
    )
  );
};
