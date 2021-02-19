import { Provider } from "../../libs/connections";
import { map } from "../../libs/connections/processors2";
import { newStateOptionalMapper } from "../../libs/named-state";
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

const barMessage = (message: string) => span({ class: "flex-1 f4" }, message);

const barProps = {
  class: `position-sticky Box p-2 mt-4 bottom-2 d-flex flex-items-center bg-gray box-shadow-medium`,
};

const bar = (...controls: JsonHtml[]) => div(barProps, ...controls);

const popUpBar = (...controls: JsonHtml[]) =>
  div(
    {
      ...barProps,
      class: `${barProps.class} anim-fade-up`,
      style: { "animation-delay": "0s" },
    },
    ...controls
  );

const styledButton = (label: string, onClick?: () => void, extraClass = "") =>
  button(
    {
      class: `btn mr-2 ${extraClass}`,
      type: "button",
      onClick: onClick,
    },
    label
  );

const editBarView: OptionalView<EditBarState> = newStateOptionalMapper({
  visible: ({ onSave, onDiscard }) =>
    popUpBar(
      barMessage(
        onDiscard
          ? "Document has been modified"
          : "External document, not yet saved"
      ),
      ...(onDiscard ? [styledButton("Discard", onDiscard, "btn-danger")] : []),
      styledButton("Save", onSave, "btn-primary")
    ),
  error: ({ reason, onTryAgain }) =>
    bar(
      barMessage(`Error saving document ${reason}`),
      styledButton("Try again", onTryAgain, "btn-primary")
    ),
  saving: () => bar(styledButton("Saving", undefined, "btn-primary")),
});

export const editBar: Component<{
  provider: Provider<EditBarState>;
}> = ({ provider }) => (render) => {
  provider(map(editBarView, render));
};
