import { link, map } from "linki";

import { newStateMapper } from "../../../libs/named-state";
import {
  Component,
  OptionalJsonHtml,
  OptionalViewSetup,
} from "../../../libs/simple-ui/render";
import {
  EditBarState,
  errorBar,
  popUpBar,
  simpleBar,
  styledButton,
} from "../../content/edit-bar";

const createUpdateBarView: OptionalViewSetup<
  { onUpdate: () => void; onDiscard: () => void },
  EditBarState
> = ({ onDiscard, onUpdate }) =>
  newStateMapper<EditBarState, OptionalJsonHtml>(undefined, {
    visible: () =>
      popUpBar(
        "Document has been modified",
        styledButton("Discard", onDiscard, "btn-danger"),
        styledButton("Update", onUpdate, "btn-primary")
      ),
    error: ({ reason, onTryAgain }) => errorBar(reason, onTryAgain),
    saving: () =>
      simpleBar("", styledButton("Updating", undefined, "btn-primary", true)),
  });

export const updateBar: Component<
  {
    onDiscard: () => void;
    onUpdate: () => void;
  },
  { updateUpdateBar: EditBarState }
> = ({ onDiscard, onUpdate }) => (render) => {
  return {
    updateUpdateBar: link(
      map(createUpdateBarView({ onUpdate, onDiscard })),
      render
    ),
  };
};
