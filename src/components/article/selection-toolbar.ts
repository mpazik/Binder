import { passOnlyChanged, Provider, wrap } from "../../libs/connections";
import { filter, map, mapTo, not } from "../../libs/connections/processors2";
import { button, Component, div, View } from "../../libs/simple-ui/render";

import { WithContainerContext } from "./comment";
export const currentSelection = (): Range | undefined => {
  const selection = window.getSelection();
  if (!selection || selection.type !== "Range") return;
  const range = selection.getRangeAt(0);
  if (!range) return;
  if (range.collapsed) return;

  return range;
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

export const rangeText = (range: Range): string => range.toString().trim();
export const rangePosition = (range: Range): [left: number, top: number] => {
  const { x, y, width } = range.getBoundingClientRect();
  return [x + width / 2, y];
};
export const rangePositionRelative = (
  range: Range,
  element: HTMLElement
): [left: number, top: number] => {
  const { x, y } = element.getBoundingClientRect();
  const [left, top] = rangePosition(range);
  return [left - x, top - y];
};

export type Button = {
  handler: (range: Range) => void;
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
          "Popover-message Popover-message--bottom BtnGroup box-shadow-large width-auto d-flex",
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
  rangeProvider: Provider<WithContainerContext<Range> | undefined>;
  buttons: Button[];
}> = ({ rangeProvider, buttons }) => (render) => {
  const renderState = map((data: WithContainerContext<Range> | undefined) => {
    if (!data) return;
    const { data: range, container } = data;
    const [left, top] = rangePositionRelative(range, container);
    return selectionToolbarView({
      left,
      top,
      buttons: buttons.map(({ handler, ...rest }) => ({
        handler: () => {
          handler(range);
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
  rangeProvider(selectionHandler);
};
