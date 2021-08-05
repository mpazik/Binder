// From https://github.com/fread-ink/epub-cfi-resolver/blob/master/index.js
import { throwIfNull } from "../errors";

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

export type EpubCfi = string;
export type EpubCfiPart = string;

export const generateEpubCfiPartForNode = (
  node: Node,
  offset = 0
): EpubCfiPart => {
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

export const generateEpubCfiPartForId = (fragment: string): EpubCfiPart =>
  `[${fragment}]`;

export const generateEpubCfi = (...parts: EpubCfiPart[]): EpubCfi =>
  `epubcfi(${parts.join("!")})`;

export const generateEpubCfiFromNodes = (node: Node | Node[]): EpubCfi => {
  const nodes = Array.isArray(node) ? node : [node];
  const parts = nodes.map(generateEpubCfiPartForNode);
  return generateEpubCfi(...parts);
};

export const emptyEpubCfi = generateEpubCfi();

const isCFI = new RegExp(/^epubcfi\((.*)\)$/);
const hasNodeId = new RegExp(/^.*\[(.*)]$/);

export const getCfiParts = (cfi: EpubCfi): string[] => {
  const match = cfi.trim().match(isCFI);
  if (!match) throw new Error("Not a valid CFI");
  const cfiContent = match[1];
  return cfiContent.split("!");
};

export const nodeIdFromCfiPart = (cfiPart: string): string => {
  const nodeIdMatch = cfiPart.match(hasNodeId);
  if (!nodeIdMatch)
    throw new Error(`CFI part '${cfiPart}' does not have node id at the end`);
  return nodeIdMatch[1];
};

// Simplistic implementation not compatible with standards, works only on ids,
export const customParseFirstSegmentEpubCfi = (
  cfi: EpubCfi,
  dom: Document
): Element =>
  throwIfNull(dom.getElementById(nodeIdFromCfiPart(getCfiParts(cfi)[0])));
