import type { DocFragment } from "./annotation";

export type Position = [left: number, right: number];

export type Selection = {
  container: HTMLElement;
  fragment?: DocFragment;
  range: Range;
};

export type OptSelection = Selection | undefined;

const currentRange = (): Range | undefined => {
  const selection = window.getSelection();
  if (!selection || selection.type !== "Range") return;
  const range = selection.getRangeAt(0);
  if (!range) return;
  if (range.collapsed) return;

  return range;
};

export const clearSelection = (): void => {
  window.getSelection()?.removeAllRanges();
};

const rangeMiddlePosition = (range: Range): [left: number, top: number] => {
  const { x, y, width } = range.getBoundingClientRect();
  return [x + width / 2, y];
};

const rangePositionRelative = (
  range: Range,
  container: HTMLElement
): [left: number, top: number] => {
  const { x, y } = container.getBoundingClientRect();
  const [left, top] = rangeMiddlePosition(range);
  return [left - x, top - y];
};

export const selectionExists = (): boolean => {
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

export const selectionPosition = ({ range, container }: Selection): Position =>
  rangePositionRelative(range, container);

export const currentSelection = (): Range | undefined => {
  const range = currentRange();
  return range && range.toString().trim().length > 0 ? range : undefined;
};
