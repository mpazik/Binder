import { Provider } from "../../libs/connections";
import { map } from "../../libs/connections/processors2";
import { button, Component, div, View } from "../../libs/simple-ui/render";

export type Selection = {
  text: string;
  left: number;
  top: number;
  range: Range;
};

export const currentSelection = (): Selection | undefined => {
  const selection = window.getSelection();
  if (!selection || selection.type !== "Range") return;
  const range = selection.getRangeAt(0);
  if (!range) return;

  const { x, y, width } = range.getBoundingClientRect();
  const text = range.toString().trim();
  return { text, left: x + width / 2, top: y, range };
};

export const offsetSelection = (
  element: HTMLElement,
  selection: Selection
): Selection => {
  const { x, y } = element.getBoundingClientRect();
  return {
    ...selection,
    left: selection.left - x,
    top: selection.top - y,
  };
};

export const selectionToolbarView: View<{
  left: number;
  top: number;
  onAddComment: () => void;
}> = ({ left, top, onAddComment }) =>
  div(
    {
      class: "Popover",
      style: { left, top, transform: "translate(-50%, -125%)" },
    },
    div(
      {
        class:
          "Popover-message Popover-message--bottom width-auto BtnGroup box-shadow-large",
      },
      button(
        {
          class: `BtnGroup-item btn btn-sm`,
          type: "button",
          onClick: onAddComment,
        },
        "add comment"
      )
    )
  );

export const selectionToolbar: Component<{
  selectionProvider: Provider<Selection | undefined>;
  onAddComment: (arg: { top: number }) => void;
}> = ({ selectionProvider, onAddComment }) => (render) => {
  const renderSelection = (selection: Selection | undefined) => {
    if (!selection) return undefined;
    return selectionToolbarView({
      left: selection.left,
      top: selection.top,
      onAddComment: () => {
        onAddComment({ top: selection.top });
        renderSelection(undefined);
      },
    });
  };

  selectionProvider(map(renderSelection, render));
};
