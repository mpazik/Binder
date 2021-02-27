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
  containerText: string,
  range: Range
): QuoteSelector => {
  const positionStart = positionFromBegging(
    container,
    range.startContainer,
    range.startOffset
  );
  const exact = range.toString().trim();
  const [prefix, suffix] = expandText(
    containerText,
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

const renderHighlights = (parts: Text[]) => {
  parts.forEach((part) => {
    const highlightEl = document.createElement("span");
    highlightEl.classList.add("highlight");
    const parent = part.parentNode!;

    parent.replaceChild(highlightEl, part);
    highlightEl.appendChild(part);
  });
};

const findParts = (root: HTMLElement, start: number, length: number) => {
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

export const addComment = (
  root: HTMLElement,
  contentText: string,
  annotation: Annotation
): void => {
  const selector = annotation.target.selector;
  const exact = selector.exact;
  const phrase = (selector.prefix || "") + exact + (selector.suffix || "");
  const start = contentText.indexOf(phrase) + (selector.prefix?.length || 0);

  console.log(start);
  if (start < 0) {
    console.error("Could not select text for: " + JSON.stringify(annotation));
  }

  renderHighlights(findParts(root, start, exact.length));
};
