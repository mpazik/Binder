import {
  Callback,
  dataPortal,
  Provider,
  ProviderSetup,
} from "../../connections";
import { map, pipe, wrap } from "../../connections/mappers";
import { Network, resumableNetwork } from "../../connections/network";
import {
  button,
  Component,
  ComponentRuntime,
  div,
  setupComponent,
  slot,
  span,
  View,
  ViewSetup,
} from "../render";

const periodicProvider: ProviderSetup<number, number> = (start) => (
  onClose,
  push
) => {
  console.log(`periodic provider started on: ${start}`);

  let secondsTotal = start;
  const interval = setInterval(async () => {
    secondsTotal += 1;
    console.log(`count: ${secondsTotal}`);
    push(secondsTotal);
  }, 1000);

  push(secondsTotal);

  onClose(() => {
    clearInterval(interval);
    console.log("periodic provider aborted");
  });
};

const createIncreaseState = (consume: (state: number) => void) => {
  let n = 1;
  consume(n);
  return () => {
    n += 1;
    consume(n);
  };
};

const timerView: View<{ n: number }> = ({ n }) => {
  return div(`time:${n}`);
};

const subNetwork: Network<{
  seconds: number;
  consumer: Callback<number>;
}> = ({ seconds, consumer }, onClose) => {
  periodicProvider(seconds)(onClose, consumer);
};

const timer: Component<{ start: Provider<number>; init: number }> = ({
  start,
  init,
}) => (render, onClose) => {
  const startSubnetwork = resumableNetwork(subNetwork, onClose);

  const startTimer = (seconds: number) => {
    startSubnetwork({
      seconds,
      consumer: (n) => render(timerView({ n })),
    });
  };
  start(onClose, startTimer);
  startTimer(init);
};

const mainView: ViewSetup<
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
    ...(num % 2 === 0 ? [slot("bottom-slot", bottomSlot)] : [])
  );

const main: Component = () => (render) => {
  const [timerProvider, setTimerStart] = dataPortal<number>();
  const renderMainView = mainView({
    init: "test",
    bottomSlot: timer({
      start: timerProvider,
      init: 3,
    }),
    onClick: () => increaseState(),
    onClickTrigger: () => setTimerStart(Math.floor(Math.random() * 10)),
  });

  const increaseState = createIncreaseState(
    map(pipe(wrap("num"), renderMainView), render)
  );
};

setupComponent(main(), document.body);
