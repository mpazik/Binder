import { fork, link, map } from "linki";

import { newStateMapper } from "../../libs/named-state";
import type {
  Component,
  JsonHtml,
  OptionalJsonHtml,
  OptionalViewSetup,
} from "../../libs/simple-ui/render";
import { button, div, span } from "../../libs/simple-ui/render";

export type EditBarState =
  | ["hidden"]
  | ["visible"]
  | ["saving"]
  | ["error", { onTryAgain: () => void; reason: string }];

const barProps = {
  class: `position-sticky Box p-2 mt-4 bottom-2 d-flex flex-items-center color-bg-tertiary color-shadow-medium with-line-length-settings`,
};

const editBar = ({
  message = "",
  controls,
  popup = false,
}: {
  controls: JsonHtml[];
  message?: string;
  popup?: boolean;
}) =>
  div(
    popup
      ? {
          ...barProps,
          class: `${barProps.class} anim-fade-up`,
          style: { "animation-delay": "0s" },
        }
      : barProps,
    span({ class: "flex-1 f4" }, message),
    ...controls
  );

export const simpleBar = (message: string, ...controls: JsonHtml[]): JsonHtml =>
  editBar({
    message,
    controls,
  });

export const popUpBar = (message: string, ...controls: JsonHtml[]): JsonHtml =>
  editBar({
    message,
    controls,
    popup: true,
  });

export const errorBar = (reason: string, onTryAgain: () => void): JsonHtml =>
  simpleBar(
    `Error saving document ${reason}`,
    styledButton("Try again", onTryAgain, "btn-primary")
  );

export const styledButton = (
  label: string,
  onClick?: () => void,
  extraClass = "",
  disabled = false
): JsonHtml =>
  button(
    {
      class: `btn mr-2 ${extraClass}`,
      type: "button",
      onClick: onClick,
      disabled,
    },
    label
  );

const createSaveBarView: OptionalViewSetup<
  { onSave: () => void },
  EditBarState
> = ({ onSave }) =>
  newStateMapper<EditBarState, OptionalJsonHtml>(undefined, {
    visible: () =>
      popUpBar(
        "External document, not yet saved",
        styledButton("Save", onSave, "btn-primary")
      ),
    error: ({ reason, onTryAgain }) => errorBar(reason, onTryAgain),
    saving: () =>
      simpleBar("", styledButton("Saving", undefined, "btn-primary", true)),
  });

export const saveBar: Component<
  {
    onSave: () => void;
  },
  { updateSaveBar: EditBarState }
> = ({ onSave }) => (render) => {
  return {
    updateSaveBar: fork(link(map(createSaveBarView({ onSave })), render)),
  };
};
