import {
  button,
  Component,
  div,
  h3,
  setupComponent,
  Slot,
  slot,
  span,
  ViewSetup,
} from "../render";

const subComponent: Component<{ param: string }> = ({ param }) => (render) => {
  render(div(h3("sub-component"), span(`Value: ${param}`)));
};

const mainView: ViewSetup<{
  init: string;
  bottomSlot: Slot;
  onClick: () => void;
}> = ({ onClick, bottomSlot }) => () =>
  div(
    {
      id: "main",
    },
    button({ onClick: onClick }, "test"),
    bottomSlot
  );

const main: Component = () => (render) => {
  const renderMainView = mainView({
    init: "test",
    bottomSlot: slot(
      "bottom-slot",
      subComponent({
        param: "custom param",
      })
    ),
    onClick: () => alert("clicked"),
  });
  render(renderMainView());
};

setupComponent(main(), document.body);
