import { Provider } from "../../libs/connections";
import { Component, div, JsonHtml } from "../../libs/simple-ui/render";

type ModalViewState = {
  top: number;
  left: number;
  content?: JsonHtml;
};
export type ModalState = ModalViewState | undefined;

const modalView = (
  { top, left, content }: ModalViewState,
  closeModal: () => void
) =>
  div(
    div(
      {
        class: "Popover Box box-shadow-extra-large",
        style: {
          top,
          left,
        },
      },
      content ?? ""
    ),
    div({
      style: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        position: "fixed",
      },
      onClick: closeModal,
    })
  );

export const modal: Component<{ stateProvider: Provider<ModalState> }> = ({
  stateProvider,
}) => (render) => {
  const renderModal = (state: ModalState) => {
    render(state ? modalView(state, () => renderModal(undefined)) : undefined);
  };
  stateProvider(renderModal);
};
