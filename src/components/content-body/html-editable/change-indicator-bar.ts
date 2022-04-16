import type { Callback } from "linki";
import { link, map, passUndefined } from "linki";
import type { UiComponent, View } from "linki-ui";
import { div } from "linki-ui";

import { firstOf, lastOf } from "../../../libs/array";

import type { DocumentChange } from "./document-change";

export const documentChangeTopRelativePosition = ({
  editor,
  newLines,
}: DocumentChange): number => {
  const editorTop = editor.getBoundingClientRect().y;
  return firstOf(newLines).getBoundingClientRect().y - editorTop;
};

export const documentChangeHeight = ({ newLines }: DocumentChange): number => {
  const lastRect = lastOf(newLines).getBoundingClientRect();
  return (
    lastRect.height + lastRect.y - firstOf(newLines).getBoundingClientRect().y
  );
};

const changeIndicator: View<{
  docDiff: DocumentChange;
  onClick: Callback<DocumentChange>;
}> = ({ docDiff, onClick }) => {
  const { changeType } = docDiff;
  const elementTop = documentChangeTopRelativePosition(docDiff);

  const [top, height] =
    changeType === "del"
      ? [elementTop - 5, 10]
      : [elementTop, documentChangeHeight(docDiff)];

  return div({
    class: `diff ${changeType}`,
    title: changeType,
    style: {
      top: `${top}px`,
      height: `${height}px`,
    },
    onClick: () => {
      onClick(docDiff);
    },
  });
};

export const changesIndicatorBar: UiComponent<
  { displayChangesOnBar: DocumentChange[] | undefined },
  { onDiffBarClick: DocumentChange }
> = ({ onDiffBarClick, render }) => ({
  displayChangesOnBar: link(
    map(
      passUndefined((changes: DocumentChange[]) =>
        div(
          {
            class: "color-bg-tertiary position-absolute",
            style: { height: "100%", width: "8", left: "-20", top: "0" },
          },
          ...changes.map((docDiff) =>
            changeIndicator({ docDiff, onClick: onDiffBarClick })
          )
        )
      )
    ),
    render
  ),
});
