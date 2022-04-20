import { link, map } from "linki";
import type { JsonHtml, UiComponent, View } from "linki-ui";

import { newStateMapper } from "../../../../../libs/named-state";
import type { EditBarState } from "../../edit-bar";
import { errorBar, popUpBar, simpleBar, styledButton } from "../../edit-bar";

const createUpdateBarView = ({
  onDiscard,
  onUpdate,
}: {
  onUpdate: () => void;
  onDiscard: () => void;
}): View<EditBarState> =>
  newStateMapper<EditBarState, JsonHtml>(undefined, {
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

export const updateBar: UiComponent<
  { updateUpdateBar: EditBarState },
  {
    onDiscard: void;
    onUpdate: void;
  }
> = ({ onDiscard, onUpdate, render }) => ({
  updateUpdateBar: link(
    map(createUpdateBarView({ onUpdate, onDiscard })),
    render
  ),
});
