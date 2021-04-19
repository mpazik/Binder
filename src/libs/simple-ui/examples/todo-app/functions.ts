import {
  BooleanChange,
  booleanChanger,
  EntityListChange,
  entityListChanger,
  fork,
  ObjectChange,
  objectChanger,
  Processor,
} from "../../../connections";
import { filter } from "../../../connections/filters";
import { map } from "../../../connections/mappers";

import { newTodo, Todo, TodoId, TodoName } from "./model";

/**
 * @param keyCode full list of key codes available at {@link https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values}
 */
export const isKey = (keyCode: string) => (event: KeyboardEvent): boolean =>
  event.code === keyCode;

const inputValue = (event: Event): string =>
  (event.target as HTMLInputElement).value;

export const onSubmit: Processor<KeyboardEvent, string> = (push) =>
  filter(isKey("Enter"), fork(map(inputValue, push), focusTarget));

export const focusTarget = (event: Event): void =>
  (event.target as HTMLInputElement).focus();

export const focusAndSelectTarget = (event: Event): void => {
  const input = event.target as HTMLInputElement;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
};

export const countActive = (todos: Todo[]): number =>
  todos.filter((it) => !it.completed).length;

export type TodoFilter = "all" | "active" | "completed";

export const filterShowingTodos = ([todoFilter, todos]: [
  TodoFilter,
  Todo[]
]): Todo[] => {
  if (todoFilter == "all") {
    return todos;
  }
  const showCompleted = todoFilter === "completed";
  return todos.filter((it) => it.completed === showCompleted);
};

export type TodoChange = EntityListChange<Todo, TodoId, ObjectChange<Todo>>;

export const getTodoId = (todo: Todo): TodoId => todo.id;

export const todosChanger = entityListChanger<Todo, TodoId, ObjectChange<Todo>>(
  getTodoId,
  objectChanger((prop, change) =>
    typeof prop === "boolean"
      ? booleanChanger()(prop, change as BooleanChange)
      : prop
  )
);

export const pluralize = (word: string) => (count: number): string =>
  count === 1 ? word : word + "s";

export const newTodoName = (id: TodoId) => (event: Event): TodoChange => [
  "chg",
  id,
  ["set", "title", (event.target as HTMLInputElement).value as TodoName],
];

export const addNewTodo = (title: TodoName): TodoChange => [
  "set",
  newTodo(title),
];
