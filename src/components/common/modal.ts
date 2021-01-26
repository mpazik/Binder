import { Provider } from "../../libs/connections";
import { Component, div, JsonHtml } from "../../libs/simple-ui/render";

export type ModalState =
  | {
      top: number;
      left: number;
      content: JsonHtml;
    }
  | undefined;

export const modal: Component<{ stateProvider: Provider<ModalState> }> = ({
  stateProvider,
}) => (render) => {
  const renderModal = (state: ModalState) => {
    if (state) {
      render(
        div(
          div(
            {
              class: "Popover Box box-shadow-extra-large",
              style: {
                top: state.top,
                left: state.left,
              },
            },
            state.content
          ),
          div({
            style: {
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              position: "fixed",
            },
            onClick: () => {
              renderModal(undefined);
            },
          })
        )
      );
    } else {
      render(div());
    }
  };
  stateProvider(renderModal);
};
