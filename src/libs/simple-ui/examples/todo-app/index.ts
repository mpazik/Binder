import { urlHashProvider } from "../../../browser-providers";
import {
  Callback,
  combine,
  Consumer,
  fork,
  match,
  onAnimationFrame,
  passOnlyChanged,
  Provider,
  reduce,
  split,
} from "../../../connections";
import "todomvc-app-css/index.css";
import { filter } from "../../../connections/filters";
import { map, mapTo, pipe, toObject, wrap } from "../../../connections/mappers";
import { itemsReconciliation } from "../../items-reconciliation";
import {
  a,
  button,
  classList,
  Component,
  ComponentItem,
  div,
  footer,
  h1,
  header,
  newSlot,
  input,
  label,
  li,
  Listener,
  section,
  setupComponent,
  slot,
  span,
  strong,
  ul,
  View,
  ViewSetup,
  Slot,
} from "../../render";

import {
  addNewTodo,
  countActive,
  filterShowingTodos,
  focusAndSelectTarget,
  focusTarget,
  getTodoId,
  isKey,
  newTodoName,
  onSubmit,
  pluralize,
  TodoChange,
  TodoFilter,
  todosChanger,
} from "./functions";
import { newTodo, Todo, TodoId } from "./model";

const TodoItemView: ViewSetup<
  {
    onToggle: Listener<"change">;
    onEditStarted: Listener<"dblclick">;
    onEditSubmit: Listener<"blur">;
    onDestroy: Listener<"click">;
    onKeydown: Listener<"keydown">;
    onEditDisplay: Listener<"display">;
  },
  { todo: Todo; editing: boolean }
> = (props) => ({ todo, editing }) => {
  return li(
    { class: classList({ completed: todo.completed, editing }) },
    div(
      { class: "view" },
      input({
        class: "toggle",
        type: "checkbox",
        checked: todo.completed,
        onChange: props.onToggle,
      }),
      label({ onDblclick: props.onEditStarted }, todo.title),
      button({ class: "destroy", onClick: props.onDestroy })
    ),
    ...(editing
      ? [
          input({
            onDisplay: props.onEditDisplay,
            class: "edit",
            onBlur: props.onEditSubmit,
            onKeydown: props.onKeydown,
            value: todo.title,
          }),
        ]
      : [])
  );
};

const TodoItemComponent: ComponentItem<
  Todo,
  TodoId,
  {
    destroyed: Consumer<TodoId>;
    toggled: Consumer<TodoId>;
    edited: Consumer<TodoChange>;
  }
> = ({ itemProvider, destroyed, edited, id, toggled }) => (render, onClose) => {
  const newTodoNameOut = fork(
    () => editing(false),
    map(newTodoName(id), edited)
  );
  const renderView: Callback<{ todo: Todo; editing: boolean }> = map(
    TodoItemView({
      onToggle: mapTo(id, toggled),
      onEditDisplay: focusAndSelectTarget,
      onEditStarted: fork(() => editing(true), focusTarget),
      onEditSubmit: newTodoNameOut,
      onKeydown: split(
        isKey("Enter"),
        newTodoNameOut,
        filter(isKey("Escape"), () => editing(false))
      ),
      onDestroy: mapTo(id, destroyed),
    }),
    render
  );

  const [todo, editing] = combine(
    // new name triggers editing change and might cause getting new item which would cause a glitch
    onAnimationFrame(onClose, map(toObject("todo", "editing"), renderView)),
    undefined as Todo | undefined,
    false
  );
  itemProvider(onClose, todo);
};

const TodoListView: ViewSetup<
  {
    destroyed: (id: TodoId) => void;
    toggled: (id: TodoId) => void;
    edited: (change: TodoChange) => void;
  },
  { list: { id: TodoId; provider: Provider<Todo> }[] }
> = ({ destroyed, toggled, edited }) => ({ list }) =>
  ul(
    { class: "todo-list" },
    ...list.map(({ id, provider }) =>
      slot(
        "item." + id,
        TodoItemComponent({
          id: id,
          itemProvider: provider,
          destroyed,
          toggled,
          edited,
        })
      )
    )
  );

const TodoList: Component<
  {
    changeTodo: Consumer<TodoChange>;
  },
  { showingTodos: Todo[] }
> = ({ changeTodo }) => (render) => {
  const renderList = TodoListView({
    destroyed: map((it: TodoId): TodoChange => ["del", it], changeTodo),
    toggled: map(
      (it: TodoId): TodoChange => ["chg", it, ["chg", "completed", ["tgl"]]],
      changeTodo
    ),
    edited: changeTodo,
  });

  return {
    showingTodos: itemsReconciliation<Todo, TodoId>(getTodoId)(
      map(pipe(wrap("list"), renderList), render)
    ),
  };
};

const selectorLink = (
  current: TodoFilter,
  filter: TodoFilter,
  href: string,
  label: string
) => li(a({ href, class: classList({ selected: current === filter }) }, label));

const FooterView: View<{
  count: number;
  activeTodoWord: string;
  todoFilter: TodoFilter;
}> = ({ count, activeTodoWord, todoFilter }) =>
  footer(
    { class: "footer" },
    span(
      { class: "todo-count" },
      strong(count.toString()),
      " ",
      activeTodoWord,
      " left"
    ),
    ul(
      { class: "filters" },
      selectorLink(todoFilter, "all", "#/", "All"),
      " ",
      selectorLink(todoFilter, "active", "#/active", "Active"),
      " ",
      selectorLink(todoFilter, "completed", "#/completed", "Completed")
    )
  );

const Footer: Component<
  void,
  {
    activeItemsCount: number;
    todoFilter: TodoFilter;
  }
> = () => (render) => {
  const [setFilter, setCount, setActiveTodoWork] = combine(
    map(
      pipe(toObject("todoFilter", "count", "activeTodoWord"), FooterView),
      render
    ),
    "all" as TodoFilter,
    0,
    "items"
  );
  return {
    activeItemsCount: fork(setCount, map(pluralize("item"), setActiveTodoWork)),
    todoFilter: setFilter,
  };
};

const AppView: ViewSetup<{
  footer: Slot;
  main: Slot;
  onKeydown: Listener<"keydown">;
  onToggleAll: Listener<"change">;
  onInputDisplayed: Listener<"display">;
}> = ({ footer, onInputDisplayed, main, onKeydown, onToggleAll }) => () => {
  return div(
    header(
      { class: "header" },
      h1("todos"),
      input({
        type: "text",
        class: "new-todo",
        placeholder: "What needs to be done?",
        onDisplay: onInputDisplayed,
        onKeydown: onKeydown,
      })
    ),
    section(
      { class: "main" },
      input({
        id: "toggle-all",
        class: "toggle-all",
        type: "checkbox",
        // checked: activeTodoCount === 0,
        onChange: onToggleAll,
      }),
      label({ for: "toggle-all" }),
      main
    ),
    footer
  );
};

const AppComponent: Component = () => (render, onClose) => {
  const [footer, { activeItemsCount, todoFilter }] = newSlot(
    "footer",
    Footer()
  );
  const [main, { showingTodos }] = newSlot(
    "main",
    TodoList({
      changeTodo: (e) => updateTodoList(e),
    })
  );

  const renderAppView: Callback<void> = map(
    AppView({
      onToggleAll: (event) => {
        updateTodoList([
          "all",
          ["set", "completed", (event.target as HTMLInputElement).checked],
        ]);
      },
      onInputDisplayed: focusTarget,
      onKeydown: onSubmit(
        fork(
          () => renderAppView(),
          map(addNewTodo, (e) => updateTodoList(e))
        )
      ),
      footer,
      main,
    }),
    render
  );

  renderAppView();

  const [setFilter, setTodos] = combine(
    map(filterShowingTodos, showingTodos),
    "all" as TodoFilter,
    [] as Todo[]
  );

  const updateTodoList = reduce(
    [newTodo("first")],
    todosChanger,
    fork(map(countActive, passOnlyChanged(activeItemsCount)), setTodos)
  );

  urlHashProvider(
    onClose,
    match(
      new Map<string, TodoFilter>([
        ["#/", "all"],
        ["#/active", "active"],
        ["#/completed", "completed"],
      ]),
      fork(todoFilter, setFilter)
    )
  );
};

const root = document.createElement("div");
document.body.appendChild(root);
setupComponent(AppComponent(), root);
