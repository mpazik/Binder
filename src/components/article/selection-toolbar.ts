import { passOnlyChanged, Provider } from "../../libs/connections";
import { filter, map, mapTo, not } from "../../libs/connections/processors2";
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
  if (range.collapsed) return;

  const { x, y, width } = range.getBoundingClientRect();
  const text = range.toString().trim();
  return { text, left: x + width / 2, top: y, range };
};

const selectionExists = (): boolean => {
  const selection = window.getSelection();
  return Boolean(
    selection &&
      selection.rangeCount > 0 &&
      selection.getRangeAt(0) &&
      !selection.getRangeAt(0).collapsed &&
      selection.getRangeAt(0).getBoundingClientRect().width > 0 &&
      selection.getRangeAt(0).getBoundingClientRect().height > 0
  );
};

export const clearSelection = (): void => {
  window.getSelection()?.removeAllRanges();
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

export type Button = {
  handler: (s: Selection) => void;
  label: string;
};

export const selectionToolbarView: View<{
  left: number;
  top: number;
  buttons: Button[];
}> = ({ left, top, buttons }) =>
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
      ...buttons.map(({ handler, label }) =>
        button(
          {
            class: `BtnGroup-item btn btn-sm`,
            type: "button",
            onClick: handler,
          },
          label
        )
      )
    )
  );

export const selectionToolbar: Component<{
  selectionProvider: Provider<Selection | undefined>;
  buttons: Button[];
}> = ({ selectionProvider, buttons }) => (render) => {
  const renderState = map((selection: Selection | undefined) => {
    if (!selection) return;
    return selectionToolbarView({
      left: selection.left,
      top: selection.top,
      buttons: buttons.map(({ handler, ...rest }) => ({
        handler: () => {
          handler(selection);
          selectionHandler(undefined);
        },
        ...rest,
      })),
    });
  }, render);

  const selectionHandler = passOnlyChanged(renderState);
  document.addEventListener(
    "mouseup",
    filter(not(selectionExists), mapTo(undefined, selectionHandler))
  );
  selectionProvider(selectionHandler);
};
