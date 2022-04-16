import type { JsonHtml, UiComponent } from "linki-ui";
import { div } from "linki-ui";

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
        class: "Popover Box color-shadow-extra-large",
        style: {
          left: `${left}px`,
          top: `${top}px`,
        },
      },
      content ?? ""
    ),
    blanket({ onClick: closeModal })
  );

export const modal: UiComponent<{ displayModal: ModalState }> = ({
  render,
}) => {
  const renderModal = (state: ModalState) => {
    render(state ? modalView(state, () => renderModal(undefined)) : undefined);
  };
  return {
    displayModal: renderModal,
  };
};
