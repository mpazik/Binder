import { Callback, link } from "linki";

import { firstOf, lastOf } from "../../../libs/array";
import { splitDefined } from "../../../libs/linki";
import { Component, div, View } from "../../../libs/simple-ui/render";

import { DocumentChange } from "./document-change";

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

export const changesIndicatorBar: Component<
  {
    onDiffBarClick: Callback<DocumentChange>;
  },
  { displayChangesOnBar: DocumentChange[] | undefined }
> = ({ onDiffBarClick }) => (render) => ({
  displayChangesOnBar: link(splitDefined<DocumentChange[]>(), [
    (changes: DocumentChange[]) =>
      render(
        div(
          {
            class: "color-bg-tertiary position-absolute",
            style: { height: "100%", width: 8, left: -20, top: 0 },
          },
          ...changes.map((docDiff) =>
            changeIndicator({ docDiff, onClick: onDiffBarClick })
          )
        )
      ),
    render,
  ]),
});
