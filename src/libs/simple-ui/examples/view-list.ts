import { reducer } from "../../connections";
import {
  button,
  Component,
  div,
  p,
  setupComponent,
  View,
  ViewSetup,
} from "../render";

const item: View<{ name: string }> = ({ name }) => p(name);

const reduceStringList = (list: string[], item: string): string[] =>
  list.concat(item);

const mainView: ViewSetup<
  {
    onClick: () => void;
  },
  { list: string[] }
> = ({ onClick }) => ({ list }) =>
  div(
    {
      id: "main",
    },
    button({ onClick: onClick }, "add item"),
    div({ class: "list" }, ...list.map((it) => item({ name: it })))
  );

const main: Component = () => (render) => {
  const renderMainView = mainView({
    onClick: () => addItem(new Date().toISOString()),
  });

  const addItem = reducer([], reduceStringList, (list) =>
    render(renderMainView({ list }))
  );
};

setupComponent(main(), document.body);
