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

const subComponent: Component<{ param: string }> = ({ param }) => (render) => {
  render(div(h3("sub-component"), span(`Value: ${param}`)));
};

const mainView: ViewSetup<{
  init: string;
  bottomSlot: ComponentRuntime;
  onClick: () => void;
}> = ({ onClick, bottomSlot }) => () =>
  div(
    {
      id: "main",
    },
    button({ onClick: onClick }, "test"),
    slot("bottom-slot", bottomSlot)
  );

const main: Component = () => (render) => {
  const renderMainView = mainView({
    init: "test",
    bottomSlot: subComponent({
      param: "custom param",
    }),
    onClick: () => alert("clicked"),
  });
  render(renderMainView());
};

setupComponent(main(), document.body);
