import { Provider } from "../../libs/connections";
import { map } from "../../libs/connections/processors2";
import { newStateMapper } from "../../libs/named-state";
import {
  button,
  Component,
  div,
  JsonHtml,
  OptionalView,
  span,
} from "../../libs/simple-ui/render";

export type EditBarState =
  | ["hidden"]
  | ["visible", { onSave: () => void; onDiscard?: () => void }]
  | ["saving"]
  | ["error", { onTryAgain: () => void; reason: string }];

function bar(message: string, ...controls: JsonHtml[]) {
  return div(
    {
      class:
        "position-sticky Box p-2 mt-4 bottom-2 box-shadow-medium anim-fade-up d-flex flex-row-reverse bg-gray",
      style: { "animation-delay": "0s" },
    },
    ...controls,
    span({ class: "flex-1 f4" }, message)
  );
}

const editBarView: OptionalView<EditBarState> = newStateMapper({
  hidden: () => undefined,
  visible: ({ onSave, onDiscard }) =>
    bar(
      onDiscard
        ? "Document has been modified"
        : "External document, not yet saved",
      button(
        {
          class: "btn btn-primary mr-2",
          type: "button",
          onClick: onSave,
        },
        "Save"
      ),
      ...(onDiscard
        ? [
            button(
              {
                class: "btn btn-danger mr-2",
                type: "button",
                onClick: onDiscard,
              },
              "Discard"
            ),
          ]
        : [])
    ),
  error: ({ reason, onTryAgain }) =>
    bar(
      `Error saving document ${reason}`,
      button(
        {
          class: "btn btn-primary mr-2",
          type: "button",
          onClick: onTryAgain,
        },
        "try again"
      )
    ),
  saving: () =>
    bar(
      "",
      button(
        {
          class: "btn btn-primary mr-2",
          type: "button",
        },
        "saving"
      )
    ),
});

export const editBar: Component<{
  provider: Provider<EditBarState>;
}> = ({ provider }) => (render) => {
  provider(map(editBarView, render));
};
