import { expandText } from "./utils/string-expant";

export type QuoteSelector = {
  type: "TextQuoteSelector";
  exact: string;
  prefix?: string;
  suffix?: string;
};

export type Annotation = {
  "@context": "http://www.w3.org/ns/anno.jsonld";
  id: string;
  type: "Annotation";
  target: {
    source: string;
    selector: QuoteSelector;
  };
};

export const createAnnotation = (
  source: string,
  selector: QuoteSelector
): Annotation => ({
  "@context": "http://www.w3.org/ns/anno.jsonld",
  id: "http://example.org/anno23",
  type: "Annotation",
  target: {
    source,
    selector,
  },
});

export const annotation: Annotation = createAnnotation(
  "nih:sha-256;0ea13c00e7c872d446332715f7bc71bcf8ed9c864ac0be09814788667cbf1f1f",
  {
    type: "TextQuoteSelector",
    exact: "synem i uczniem rzeźbiarza Patroklesa[1], wymienionego",
    prefix: "Był ",
    suffix: " przez",
  }
);

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

export const quoteSelectorForSelection = (
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

const highlightClass = "highlight";
const highlightTemporaryClass = "highlight-temp";

const renderHighlight = (
  part: Text,
  onHover?: () => void,
  onHoverOut?: () => void
) => {
  const highlightEl = document.createElement("span");
  highlightEl.classList.add(highlightClass);
  if (onHover) highlightEl.addEventListener("mouseenter", onHover);
  if (onHoverOut) highlightEl.addEventListener("mouseleave", onHoverOut);
  const parent = part.parentNode!;

  parent.replaceChild(highlightEl, part);
  highlightEl.appendChild(part);
};

const renderHighlights = (
  parts: Text[],
  onHover?: () => void,
  onHoverOut?: () => void
) => parts.forEach((it) => renderHighlight(it, onHover, onHoverOut));

const removeHighlight = (element: HTMLElement) => {
  if (!element.classList.contains(highlightClass)) {
    throw new Error(
      `Can not remove highlight on element "${element}" which does not have "${highlightClass}" class`
    );
  }
  if (element.childNodes.length !== 1) {
    throw new Error(
      `Expected highlight element "${element}" to have a single child but had ${element.children.length}`
    );
  }
  element.parentElement!.replaceChild(element.childNodes.item(0)!, element);
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
    console.error("Could not select text for: " + JSON.stringify(annotation));
  }
  return findParts(container, start, exact.length);
};

export const addComment = (
  root: HTMLElement,
  text: string,
  annotation: Annotation,
  onHover?: () => void,
  onHoverOut?: () => void
): void => {
  renderSelector(root, text, annotation.target.selector, onHover, onHoverOut);
};

export const renderSelector = (
  container: HTMLElement,
  text: string,
  selector: QuoteSelector,
  onHover?: () => void,
  onHoverOut?: () => void
): void => {
  renderHighlights(
    findPartsBySelector(container, text, selector),
    onHover,
    onHoverOut
  );
};

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

const getHighlightsFromParts = (parts: Text[]) =>
  parts.map((it) => it.parentElement!);

export const getSelectorPosition = (
  container: HTMLElement,
  text: string,
  selector: QuoteSelector
): Rect => {
  const parts = findPartsBySelector(container, text, selector);
  return getBoundingClientRect(getHighlightsFromParts(parts));
};

export const renderTemporarySelector = (
  container: HTMLElement,
  text: string,
  selector: QuoteSelector
): [cancel: () => void] => {
  const parts = findPartsBySelector(container, text, selector);
  renderHighlights(parts);
  const highlights = getHighlightsFromParts(parts);
  highlights.forEach((it) => it.classList.add(highlightTemporaryClass));

  return [
    () => {
      highlights.forEach(removeHighlight);
    },
  ];
};
