import { Processor, reducer } from "../../connections";
import {
  button,
  Component,
  div,
  p,
  setupComponent,
  View,
  ViewSetup,
} from "../renderer";

const item: View<{ name: string }> = ({ name }) => p(name);

const listAppender = <S>(initState: S[] = []): Processor<S, S[]> =>
  reducer(initState, (list, item) => {
    list.push(item);
    return list;
  });

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

  const addItem = listAppender<string>()((list) =>
    render(renderMainView({ list }))
  );
};

setupComponent(main(), document.body);
