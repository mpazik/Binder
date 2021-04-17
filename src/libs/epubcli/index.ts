// From https://github.com/fread-ink/epub-cfi-resolver/blob/master/index.js
function cfiEscape(str: string) {
  return str.replace(/[[\]^,();]/g, "^$&");
}

// Given a set of nodes that are all children
// and a reference to one of those nodes
// calculate the count/index of the node
// according to the CFI spec.
// Also re-calculate offset if supplied and relevant
function calcSiblingCount(
  nodes: NodeListOf<ChildNode>,
  n: Node,
  offset: number
) {
  let count = 0;
  let lastWasElement;
  let prevOffset = 0;
  let firstNode = true;
  let i, node;
  for (i = 0; i < nodes.length; i++) {
    node = nodes[i];
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (lastWasElement || firstNode) {
        count += 2;
        firstNode = false;
      } else {
        count++;
      }

      if (n === node) {
        if ((node as Element).tagName.toLowerCase() === "img") {
          return { count, offset };
        } else {
          return { count };
        }
      }
      prevOffset = 0;
      lastWasElement = true;
    } else if (
      node.nodeType === Node.TEXT_NODE ||
      node.nodeType === Node.CDATA_SECTION_NODE
    ) {
      if (lastWasElement || firstNode) {
        count++;
        firstNode = false;
      }

      if (n === node) {
        return { count, offset: offset + prevOffset };
      }

      prevOffset += (node as Text).textContent?.length ?? 0;
      lastWasElement = false;
    }
  }
  throw new Error("The specified node was not found in the array of siblings");
}

type CfiNode = { node: Node; offset: number };

const generatePart = ({ node, offset }: CfiNode) => {
  let cfi = "";
  let o;
  while (node.parentNode) {
    o = calcSiblingCount(node.parentNode.childNodes, node, offset);
    if (!cfi && o.offset) cfi = ":" + o.offset;

    const id: string | undefined = (node as Element).id;
    cfi = "/" + o.count + (id ? "[" + cfiEscape(id) + "]" : "") + cfi;

    node = node.parentNode;
  }

  return cfi;
};

export const generateEpubcfi = (
  node: CfiNode | CfiNode[],
  extra?: string
): string => {
  let cfi;

  if (node instanceof Array) {
    const strs = [];
    for (const n of node) {
      strs.push(generatePart(n));
    }
    cfi = strs.join("!");
  } else {
    cfi = generatePart(node);
  }

  if (extra) cfi += extra;

  return "epubcfi(" + cfi + ")";
};
