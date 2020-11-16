import { Readability } from "readability";
import { Article } from "schema-dts";

import { throwIfNull } from "../utils/errors";
import { createArticle } from "../utils/ld-schemas";
import { measureTime } from "../utils/performance";

export const articleMediaType = "text/html";
export type ArticleProcessor = (r: Response) => Promise<Article>;

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
  console.log("response url", baseUrl);
  dom.head.appendChild(base);
  const article = throwIfNull(
    measureTime("readability", () => new Readability(dom).parse())
  );

  const articleLd = createArticle(article.title, articleMediaType, [baseUrl]);

  const contentDocument = domParser.parseFromString(
    article.content,
    articleMediaType
  );

  removeBaseUrlFromFragments(contentDocument, baseUrl);

  return {
    content: contentDocument,
    linkedData: articleLd,
  };
};
