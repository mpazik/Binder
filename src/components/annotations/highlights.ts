import { throwIfNull } from "../../libs/errors";

import { QuoteSelector } from "./annotation";
import { Position } from "./selection";

type Rect = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

const getBoundingClientRect = (collection: HTMLElement[]): Rect =>
  collection
    .map((n) => n.getBoundingClientRect() as Rect)
    .reduce((acc, r) => ({
      top: Math.min(acc.top, r.top),
      left: Math.min(acc.left, r.left),
      bottom: Math.max(acc.bottom, r.bottom),
      right: Math.max(acc.right, r.right),
    }));

const getPositionFromHighlights = (highlights: HTMLElement[]): Position => {
  const { left, top, right } = getBoundingClientRect(highlights);
  return [left + (right - left) / 2, top];
};

const positionRelative = (
  position: Position,
  element: HTMLElement
): [left: number, top: number] => {
  const { x, y } = element.getBoundingClientRect();
  const [left, top] = position;
  return [left - x, top - y];
};

type HighlightColor = "purple" | "green" | "yellow";
const highlightClass = "highlight";
const highlightColorClass = (color: HighlightColor) => "highlight-" + color;

const wrapWithHighlight = (
  part: Text,
  color: HighlightColor,
  onHover?: () => void,
  onHoverOut?: () => void
) => {
  const highlight = document.createElement("span");
  highlight.classList.add(highlightClass);
  highlight.classList.add(highlightColorClass(color));
  if (onHover) highlight.addEventListener("mouseenter", onHover);
  if (onHoverOut) highlight.addEventListener("mouseleave", onHoverOut);

  const tempRange = document.createRange();
  tempRange.selectNode(part);
  tempRange.surroundContents(highlight);
  return highlight;
};

const removeHighlight = (part: Text): void => {
  const highlight = throwIfNull(part.parentElement);
  if (!highlight.classList.contains(highlightClass)) {
    console.error(
      `Can not remove highlight on element which does not have "${highlightClass}" class`,
      highlight
    );
    return;
  }
  if (highlight.childNodes.length === 1) {
    highlight.parentNode!.replaceChild(highlight.firstChild!, highlight);
  } else {
    while (highlight.firstChild) {
      highlight.parentNode!.insertBefore(highlight.firstChild, highlight);
    }
    highlight.remove();
  }
};

const findParts = (
  root: HTMLElement,
  start: number,
  length: number
): Text[] => {
  const end = start + length;
  const iterator = root.ownerDocument.createNodeIterator(
    root,
    NodeFilter.SHOW_TEXT // Only return `Text` nodes.
  );

  let partStart = -1;
  let partEnd = -1;
  const parts: Text[] = [];

  let pos = 0;
  let node: Text;
  while ((node = iterator.nextNode() as Text)) {
    const text = node.data;
    if (!text) continue;
    pos += text.length;
    if (pos <= start) continue;
    parts.push(node);
    if (parts.length === 1) {
      partStart = start - pos + text.length;
    }
    if (pos >= end) {
      partEnd = end - pos + text.length;
      break;
    }
  }
  if (parts.length === 0) {
    throw new Error("passed arguments for impossible search");
  }

  // cleanup offset from first and last part
  parts[0] = parts[0].splitText(partStart);
  if (parts.length === 1) {
    parts[parts.length - 1].splitText(partEnd - partStart);
  } else {
    parts[parts.length - 1].splitText(partEnd);
  }
  return parts;
};

const findPartsBySelector = (
  container: HTMLElement,
  text: string,
  selector: QuoteSelector
): Text[] => {
  const exact = selector.exact;
  const phrase = (selector.prefix || "") + exact + (selector.suffix || "");
  const start = text.indexOf(phrase) + (selector.prefix?.length || 0);

  if (start < 0) {
    console.error(`Could not find selector "${JSON.stringify(selector)}`);
    return [];
  }
  return findParts(container, start, exact.length);
};

export const renderSelector = (
  container: HTMLElement,
  text: string,
  selector: QuoteSelector,
  color: HighlightColor,
  onHover?: (p: Position) => void,
  onHoverOut?: () => void
): void => {
  const parts = findPartsBySelector(container, text, selector);
  const highlights = parts.map((it) =>
    wrapWithHighlight(
      it,
      color,
      onHover
        ? () => {
            onHover(
              positionRelative(getPositionFromHighlights(highlights), container)
            );
          }
        : undefined,
      onHoverOut
    )
  );
};

export const removeSelector = (
  container: HTMLElement,
  text: string,
  selector: QuoteSelector
): void => {
  const parts = findPartsBySelector(container, text, selector);
  parts.forEach(removeHighlight);
};

export const containerText = (container: HTMLElement): string =>
  container.textContent || "";
