import { QuoteSelector } from "./annotation";
import { expandText } from "./utils/string-expand";

const undefinedForEmptyString = (string: string): string | undefined =>
  string.length === 0 ? undefined : string;

const nodeTextLength = (node: Node): number => {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
    case Node.TEXT_NODE:
      return (node.textContent || "").length;
    default:
      return 0;
  }
};

const positionFromBegging = (
  container: Node,
  node: Node,
  offset = 0
): number => {
  let sibling = node.previousSibling;
  let length = offset;
  while (sibling) {
    length += nodeTextLength(sibling);
    sibling = sibling.previousSibling;
  }
  if (!node.parentElement) {
    throw new Error("Something");
  }
  if (node.parentElement === container) return length;
  return positionFromBegging(container, node.parentElement, length);
};

export const quoteSelectorForRange = (
  container: HTMLElement,
  text: string,
  range: Range
): QuoteSelector => {
  const positionStart = positionFromBegging(
    container,
    range.startContainer,
    range.startOffset
  );
  const exact = range.toString().trim();
  const [prefix, suffix] = expandText(
    text,
    positionStart,
    positionStart + exact.length
  );

  return {
    type: "TextQuoteSelector",
    exact,
    prefix: undefinedForEmptyString(prefix),
    suffix: undefinedForEmptyString(suffix),
  };
};
