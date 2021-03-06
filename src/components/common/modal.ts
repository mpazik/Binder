import { Provider } from "../../libs/connections";
import { Component, div, JsonHtml } from "../../libs/simple-ui/render";
import { blanket } from "./blanket";

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
    blanket({ onClick: closeModal })
  );

export const modal: Component<{ provider: Provider<ModalState> }> = ({
  provider,
}) => (render) => {
  const renderModal = (state: ModalState) => {
    render(state ? modalView(state, () => renderModal(undefined)) : undefined);
  };
  provider(renderModal);
};
