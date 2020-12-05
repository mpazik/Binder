import { dataPortal, Provider } from "../../connections";
import {
  button,
  Component,
  ComponentRuntime,
  div,
  h3,
  setupComponent,
  slot,
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

const subComponent: Component<{ numberProvider: Provider<number> }> = ({
  numberProvider,
}) => (render) => {
  const renderView = (num: number) => {
    render(div(h3("sub-component"), span(`Value: ${num}`)));
  };
  renderView(42);
  numberProvider(renderView);
};

const MainView: ViewSetup<
  {
    init: string;
    bottomSlot: ComponentRuntime;
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
    slot("bottom-slot", bottomSlot)
  );

const main: Component = () => (render) => {
  const [randomNumberProvider, setRandomNumber] = dataPortal<number>();
  const renderMainView = MainView({
    init: "test",
    bottomSlot: subComponent({
      numberProvider: randomNumberProvider,
    }),
    onClick: () => increaseState(),
    onClickTrigger: () => setRandomNumber(Math.floor(Math.random() * 10)),
  });

  const increaseState = createIncreaseState((num: number) => {
    render(renderMainView({ num }));
  });
};

setupComponent(main(), document.body);
