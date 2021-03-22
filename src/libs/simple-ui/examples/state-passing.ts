import {
  button,
  Component,
  div,
  h3,
  setupComponent,
  Slot,
  newSlot,
  span,
  ViewSetup,
} from "../render";

const createIncreaseState = (consume: (state: number) => void) => {
  let n = 1;
  consume(n);
  return () => {
    n += 1;
    consume(n);
  };
};

const subComponent: Component<void, { provideNumber: number }> = () => (
  render
) => {
  const renderView = (num: number) => {
    render(div(h3("sub-component"), span(`Value: ${num}`)));
  };
  renderView(42);
  return {
    provideNumber: renderView,
  };
};

const MainView: ViewSetup<
  {
    init: string;
    bottomSlot: Slot;
    onClick: () => void;
    onClickTrigger: () => void;
  },
  { num: number }
> = ({ onClick, onClickTrigger, bottomSlot }) => ({ num }) =>
  div(
    {
      id: "main",
    },
    span(`number: ${num}`),
    button({ onClick: onClick }, "test"),
    button({ onClick: onClickTrigger }, "trigger"),
    bottomSlot
  );

const main: Component = () => (render) => {
  const [bottomSlot, { provideNumber }] = newSlot(
    "bottom-slot",
    subComponent()
  );

  const renderMainView = MainView({
    init: "test",
    bottomSlot,
    onClick: () => increaseState(),
    onClickTrigger: () => provideNumber(Math.floor(Math.random() * 10)),
  });

  const increaseState = createIncreaseState((num: number) => {
    render(renderMainView({ num }));
  });
};

setupComponent(main(), document.body);
