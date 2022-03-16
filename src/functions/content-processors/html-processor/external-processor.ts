import { Readability } from "docland-readability";

import { isLocalUri } from "../../../components/common/uri";
import { throwIfNull } from "../../../libs/errors";
import type { LinkedData } from "../../../libs/jsonld-format";
import { createArticle, htmlMediaType } from "../../../libs/ld-schemas";
import { measureAsyncTime, measureTime } from "../../../libs/performance";
import type { ContentProcessor } from "../types";
import { getLinkedDataName } from "../utils";

import { blobToDocument, createDocument, documentToBlob } from "./utils";

const removeBaseUrlFromFragments = (element: HTMLElement, baseUrl: string) => {
  const links = Array.from(element.getElementsByTagName("a"));
  links.forEach((it) => {
    const href = it.getAttribute("href");
    if (href && href.startsWith(baseUrl + "#")) {
      it.setAttribute("href", href.replace(baseUrl, ""));
    }
  });
};

const removeWrappers = (element: Element, parent: Element): Element => {
  if (element.childNodes.length === 1 && element.tagName === "DIV") {
    const childNode = element.childNodes[0];
    if (childNode.nodeType === Node.ELEMENT_NODE) {
      parent.replaceChild(childNode, element);
      return removeWrappers(childNode as Element, parent);
    }
  }
  return element;
};

const cleanElement = (node: Node) => {
  for (let n = 0; n < node.childNodes.length; n++) {
    const child = node.childNodes[n];
    if (
      child.nodeType === Node.COMMENT_NODE ||
      (child.nodeType === Node.TEXT_NODE &&
        !(child.nodeValue && /\S/.test(child.nodeValue)))
    ) {
      node.removeChild(child);
      n--;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      cleanElement(child);
    }
  }
};

const documentContentRoodId = "content";
const removeRootAndContentWrappers = (contentBody: HTMLElement) => {
  const newRoot = removeWrappers(
    contentBody.childNodes[0] as HTMLElement,
    contentBody
  );

  newRoot.id = documentContentRoodId;
  Array.from(newRoot.children).forEach((child) =>
    removeWrappers(child, newRoot)
  );
};

export const externalHtmlProcessor: ContentProcessor["process"] = async (
  content,
  { url, name }
) => {
  const dom = await measureAsyncTime("parse", () => blobToDocument(content));

  if (url) {
    if (isLocalUri(url)) {
      console.log("localUrl");
    }
    const base = dom.createElement("base");
    base.href = url;
    dom.head.appendChild(base);
  }

  const article = throwIfNull(
    measureTime("readability", () =>
      new Readability(dom, { serializer: (node) => node }).parse()
    )
  );

  const articleLd: LinkedData = createArticle({
    id: url,
    name: getLinkedDataName(article.title, name),
    encodingFormat: htmlMediaType,
    urls: url ? [url] : [],
  });

  const contentElement = article.content as HTMLElement;
  removeRootAndContentWrappers(contentElement);
  cleanElement(contentElement);
  if (url) {
    removeBaseUrlFromFragments(contentElement, url);
  }

  return {
    content: documentToBlob(
      createDocument({
        title: article.title,
        contentRoot: contentElement,
        url,
      })
    ),
    linkedData: articleLd,
  };
};
