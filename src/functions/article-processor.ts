import { Readability } from "@mozilla/readability";
import { Article } from "schema-dts";

import { throwIfNull } from "../libs/errors";
import { createArticle } from "../libs/ld-schemas";
import { measureTime } from "../libs/performance";

export const articleMediaType = "text/html";

export const parseArticleContent = (body: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(body, articleMediaType);
};

const removeBaseUrlFromFragments = (
  contentDocument: Document,
  baseUrl: string
) => {
  const links = Array.from(contentDocument.getElementsByTagName("a"));
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

export const documentContentRoodId = "content";

export const getDocumentContentRoot = (contentDocument: Document): HTMLElement =>
  throwIfNull(
    contentDocument.getElementById("content"),
    () =>
      'expected that article document would have root element with id "content'
  );

const removeRootAndContentWrappers = (contentDocument: Document) => {
  const newRoot = removeWrappers(
    contentDocument.body.childNodes[0] as HTMLElement,
    contentDocument.body
  );

  newRoot.id = documentContentRoodId;
  Array.from(newRoot.children).forEach((child) =>
    removeWrappers(child, newRoot)
  );
};

export type ArticleContent = {
  content: Document;
  linkedData: Article;
};

export const processToArticle: (
  r: Response
) => Promise<ArticleContent> = async (response) => {
  const domParser = new DOMParser();
  const text = await response.text();
  const dom = measureTime("parse", () =>
    domParser.parseFromString(text, articleMediaType)
  );
  const base = dom.createElement("base");
  const baseUrl = response.url;
  base.href = baseUrl;
  dom.head.appendChild(base);
  const article = throwIfNull(
    measureTime("readability", () => new Readability(dom).parse())
  );

  const articleLd = createArticle(baseUrl, article.title, articleMediaType, [baseUrl]);

  const contentDocument = domParser.parseFromString(
    article.content,
    articleMediaType
  );

  removeRootAndContentWrappers(contentDocument);
  removeBaseUrlFromFragments(contentDocument, baseUrl);

  return {
    content: contentDocument,
    linkedData: articleLd,
  };
};
