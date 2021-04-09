import { map } from "../../../libs/connections/mappers";
import { newStateOptionalMapper } from "../../../libs/named-state";
import { Component, OptionalViewSetup } from "../../../libs/simple-ui/render";
import {
  EditBarState,
  errorBar,
  popUpBar,
  simpleBar,
  styledButton,
} from "../../article/edit-bar";

const createUpdateBarView: OptionalViewSetup<
  { onUpdate: () => void; onDiscard: () => void },
  EditBarState
> = ({ onDiscard, onUpdate }) =>
  newStateOptionalMapper({
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
    updateUpdateBar: map(createUpdateBarView({ onUpdate, onDiscard }), render),
  };
};
