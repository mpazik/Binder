import type { Callback } from "linki";
import { arrayChanger, filter, fork, link, logger, map, reduce } from "linki";
import type { UiItemComponent, View } from "linki-ui";
import {
  div,
  input,
  inputValue,
  isKey,
  cleanTarget,
  mountItemComponent,
  li,
  ul,
} from "linki-ui";

import type { CompletionSubscribeIndex } from "../../functions/indexes/completion-index";
import type { HashUri } from "../../libs/hash";

import type { TaskObject } from "./model";
import type { Task } from "./productivity-vocabulary";
import { createTask } from "./productivity-vocabulary";

const taskComponent: UiItemComponent<TaskObject> = ({ render }) => {
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
          }),
          content
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
      fork(link(map(inputValue), onSubmit), cleanTarget)
    ),
  });

export const tasksView: View<{
  saveTask: Callback<Task>;
  subscribe: CompletionSubscribeIndex;
}> = ({ saveTask, subscribe }) => {
  const getId = (it: TaskObject): HashUri => it.id;
  const [taskList, { updateItems }] = mountItemComponent(
    getId,
    taskComponent,
    {}
  );

  link(
    subscribe,
    logger("list"),
    reduce(arrayChanger(getId), []),
    updateItems
  )({
    completed: false,
  });

  return div(
    taskInput({ onSubmit: link(map(createTask), saveTask) }),
    ul({ class: "list-style-none" }, taskList)
  );
};
