import type {
  AnnotationSelector,
  DocFragment,
  QuoteSelector,
} from "./annotation";
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
  textLayer: Node,
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
  if (node.parentElement === textLayer) return length;
  return positionFromBegging(textLayer, node.parentElement, length);
};

export const quoteSelectorForRange = (
  textLayer: HTMLElement,
  text: string,
  range: Range,
  fragment?: DocFragment
): AnnotationSelector => {
  const positionStart = positionFromBegging(
    textLayer,
    range.startContainer,
    range.startOffset
  );
  const exact = range.toString().trim();
  const [prefix, suffix] = expandText(
    text,
    positionStart,
    positionStart + exact.length
  );

  const quoteSelector: QuoteSelector = {
    type: "TextQuoteSelector",
    exact,
    prefix: undefinedForEmptyString(prefix),
    suffix: undefinedForEmptyString(suffix),
  };
  if (!fragment) return quoteSelector;

  return {
    type: "FragmentSelector",
    refinedBy: quoteSelector,
    value: fragment.value,
    conformsTo: fragment.spec,
  };
};
