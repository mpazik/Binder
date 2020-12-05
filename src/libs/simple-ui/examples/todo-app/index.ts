import { urlHashProvider } from "../../../browser-providers";
import {
  Consumer,
  dataPortal,
  Provider,
  combineLatest,
  filter,
  fork,
  forkMapJoin,
  map,
  mapTo,
  match,
  onAnimationFrame,
  passOnlyChanged,
  pipe,
  reducer,
  split,
  wrap,
  wrapMerge,
} from "../../../connections";
import "todomvc-app-css/index.css";
import { itemsReconciliation } from "../../items-reconciliation";
import {
  a,
  button,
  classList,
  Component,
  ComponentItem,
  ComponentRuntime,
  div,
  footer,
  h1,
  header,
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
  TodoFilter,
  onSubmit,
  pluralize,
  TodoChange,
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
  const [todo, editing] = wrapMerge("todo", "editing")<Todo, boolean>(
    undefined,
    false
  )(
    // new name triggers editing change and might cause getting new item which would cause a glitch
    onAnimationFrame(
      onClose,
      map((props: { todo: Todo; editing: boolean }) => renderView(props))(
        render
      )
    )
  );

  const stopEditing = mapTo(false)(editing);
  const startEditing = mapTo(true)(editing);

  const newTodoNameOut = fork(stopEditing, map(newTodoName(id))(edited));
  itemProvider(todo);

  const renderView = TodoItemView({
    onToggle: mapTo(id)(toggled),
    onEditDisplay: focusAndSelectTarget,
    onEditStarted: fork(startEditing, focusTarget),
    onEditSubmit: newTodoNameOut,
    onKeydown: split(
      isKey("Enter"),
      newTodoNameOut,
      filter(isKey("Escape"))(stopEditing)
    ),
    onDestroy: mapTo(id)(destroyed),
  });
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

const TodoList: Component<{
  showingTodos: Provider<Todo[]>;
  changeTodo: Consumer<TodoChange>;
}> = ({ showingTodos, changeTodo }) => (render) => {
  const renderList = TodoListView({
    destroyed: map((it: TodoId): TodoChange => ["del", it])(changeTodo),
    toggled: map(
      (it: TodoId): TodoChange => ["chg", it, ["chg", "completed", ["tgl"]]]
    )(changeTodo),
    edited: changeTodo,
  });

  showingTodos(
    itemsReconciliation<Todo, TodoId>(getTodoId)(
      map(pipe(wrap("list")(), renderList))(render)
    )
  );
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

const Footer: Component<{
  activeItemsCount: Provider<number>;
  todoFilter: Provider<TodoFilter>;
}> = ({ activeItemsCount, todoFilter }) => (render) => {
  const combine = combineLatest(
    {
      todoFilter: "all" as TodoFilter,
    },
    { count: 0 },
    { activeTodoWord: "items" }
  )(map(FooterView)(render));

  activeItemsCount(
    forkMapJoin<number, { count: number; activeTodoWord: string }>(
      pipe(pluralize("item"), wrap("activeTodoWord")()),
      wrap("count")()
    )(combine)
  );
  todoFilter(map(wrap("todoFilter")<TodoFilter>())(combine));
};

const AppView: ViewSetup<{
  footer: ComponentRuntime;
  main: ComponentRuntime;
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
      slot("main", main)
    ),
    slot("footer", footer)
  );
};

const AppComponent: Component = () => (render, onClose) => {
  const [showingTodosProvider, showingTodos] = dataPortal<Todo[]>();
  const [activeItemsCountProvider, activeItemsCount] = dataPortal<number>();
  const [todoFilterProvider, todoFilter] = dataPortal<TodoFilter>();

  const renderAppView = AppView({
    onToggleAll: (event) => {
      updateTodoList([
        "all",
        ["set", "completed", (event.target as HTMLInputElement).checked],
      ]);
    },
    onInputDisplayed: focusTarget,
    onKeydown: onSubmit(
      fork(
        () => renderAction(),
        map(addNewTodo)((e) => updateTodoList(e))
      )
    ),
    footer: Footer({
      activeItemsCount: activeItemsCountProvider,
      todoFilter: todoFilterProvider,
    }),
    main: TodoList({
      showingTodos: showingTodosProvider,
      changeTodo: (e) => updateTodoList(e),
    }),
  });

  const renderAction = map(renderAppView)(render);
  renderAction();

  const combineShowingTodos = combineLatest(
    {
      todoFilter: "all" as TodoFilter,
    },
    { todos: [] as Todo[] }
  )(map(filterShowingTodos)(showingTodos));

  const updateTodoList = reducer(
    [newTodo("first")],
    todosChanger
  )(
    fork(
      map(countActive)(passOnlyChanged(activeItemsCount)),
      map(wrap("todos")<Todo[]>())(combineShowingTodos)
    )
  );

  urlHashProvider(
    onClose,
    match(
      new Map<string, TodoFilter>([
        ["#/", "all"],
        ["#/active", "active"],
        ["#/completed", "completed"],
      ])
    )(
      fork(
        todoFilter,
        map(wrap("todoFilter")<TodoFilter>())(combineShowingTodos)
      )
    )
  );
};

const root = document.createElement("div");
document.body.appendChild(root);
setupComponent(AppComponent(), root);
