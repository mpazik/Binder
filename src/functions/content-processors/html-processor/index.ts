import { isLocalUrl } from "../../../components/common/link";
import { htmlMediaType } from "../../../libs/ld-schemas";
import type { ContentProcessor } from "../types";

import { externalHtmlProcessor } from "./external-processor";
import { internalHtmlProcessor } from "./internal-processor";

export const parseArticleContent = (body: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(body, htmlMediaType);
};

export const documentContentRoodId = "content";

export const getDocumentContentRoot = (
  contentDocument: Document
): DocumentFragment => {
  const newParent = contentDocument.createDocumentFragment();
  const oldParent = contentDocument.body;
  while (oldParent.childNodes.length > 0) {
    newParent.appendChild(oldParent.childNodes[0]);
  }
  return newParent;
};

export const htmlContentProcessor: ContentProcessor = {
  mediaType: htmlMediaType,
  process: async (content, props) => {
    const url = props.url;
    return (url && isLocalUrl(url)
      ? internalHtmlProcessor
      : externalHtmlProcessor)(content, props);
  },
};
