import {
  entityListChanger,
  Consumer,
  dataPortal,
  reducer,
  EntityListChange,
} from "../../connections";
import { map, pipe, wrap } from "../../connections/mappers";
import { ItemProvider } from "../items-reconciliation";
import {
  button,
  Component,
  div,
  setupComponent,
  slot,
  span,
  ViewSetup,
} from "../render";

type ItemId = string;
type Item = { id: ItemId; value: string };
const item: Component<{
  removed: Consumer<ItemId>;
  clicked: Consumer<ItemId>;
  itemProvider: ItemProvider<Item, ItemId>;
}> = ({ itemProvider: { id, provider }, removed, clicked }) => (
  render,
  onClose
) => {
  const renderView = (item?: Item) =>
    render(
      div(
        button(
          {
            onClick: () => clicked(id),
          },
          "update"
        ),
        button(
          {
            onClick: () => removed(id),
          },
          "remove"
        ),
        item
          ? span(`My name is: ${id} and value: ${item.value}`)
          : span(`My name is: ${id}`)
      )
    );

  renderView();
  provider(onClose, renderView);
};

const mainView: ViewSetup<
  {
    onAdd: () => void;
    onItemClick: (id: ItemId) => void;
    onItemRemoved: (id: ItemId) => void;
  },
  { list: ItemProvider<Item, ItemId>[] }
> = ({ onItemClick, onItemRemoved, onAdd }) => ({ list }) =>
  div(
    {
      id: "main",
    },
    button({ onClick: onAdd }, "add item"),
    div(
      { class: "list" },
      ...list.map(({ id, provider }) =>
        slot(
          "item." + id,
          item({
            clicked: onItemClick,
            removed: onItemRemoved,
            itemProvider: { id, provider },
          })
        )
      )
    )
  );

const newIdGenerator = (): (() => ItemId) => {
  let num = 0;
  return () => {
    num += 1;
    return `elem${num}`;
  };
};

const main: Component = () => (render, onClose) => {
  const [listUpdatesProvider, updateList] = dataPortal<
    EntityListChange<ItemProvider<Item, ItemId>, ItemId>
  >();

  const generateId = newIdGenerator();
  const itemChangeConsumers = new Map<ItemId, Consumer<Item>>();
  const renderMainView = mainView({
    onAdd: () => {
      const id = generateId();
      const [provider, consumer] = dataPortal<Item>();
      itemChangeConsumers.set(id, consumer);
      updateList([
        "set",
        {
          id,
          provider,
        },
      ]);
    },
    onItemClick: (id) => {
      itemChangeConsumers.get(id)?.({ id, value: new Date().toISOString() });
    },
    onItemRemoved: (id) => {
      itemChangeConsumers.delete(id);
      updateList(["del", id]);
    },
  });

  listUpdatesProvider(
    onClose,
    reducer(
      [],
      entityListChanger<ItemProvider<Item, ItemId>, ItemId>(
        (it) => it.id,
        (it) => it
      ),
      map(pipe(wrap("list"), renderMainView), render)
    )
  );
};

setupComponent(main(), document.body);
