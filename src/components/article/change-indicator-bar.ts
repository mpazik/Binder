import { firstOf, lastOf } from "../../libs/array";
import { Consumer, Provider } from "../../libs/connections";
import { Component, div, View } from "../../libs/simple-ui/render";

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
  onClick: Consumer<DocumentChange>;
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

export const changesIndicatorBar: Component<{
  changesProvider: Provider<DocumentChange[] | undefined>;
  onDiffBarClick: Consumer<DocumentChange>;
}> = ({ changesProvider, onDiffBarClick }) => (render) => {
  const renderGutter = (changes: DocumentChange[]) =>
    render(
      div(
        {
          id: "editor-gutter",
          class: "bg-gray position-absolute",
          style: { height: "100%", width: "8px", left: "-20px" },
        },
        ...changes.map((docDiff) =>
          changeIndicator({ docDiff, onClick: onDiffBarClick })
        )
      )
    );
  changesProvider((changes) =>
    changes ? renderGutter(changes) : render(undefined)
  );
};
