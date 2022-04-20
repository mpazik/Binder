import { pick, pipe } from "linki";

import type { LinkedData } from "../../../libs/jsonld-format";
import { measureAsyncTime } from "../../../libs/performance";
import type { ContentProcessor } from "../types";

import { blobToDocument } from "./utils";

export const processInternalDocument = (dom: Document): LinkedData => {
  const jsonLdScripts = dom.querySelectorAll(
    'script[type="application/ld+json"]'
  );

  const jsonLds = Array.from(jsonLdScripts).map(
    pipe(pick("innerHTML"), JSON.parse)
  );

  const linkedData = jsonLds[0];
  if (linkedData === undefined) {
    throw new Error("Loaded page in incorrect format");
  }

  linkedData["url"] = dom.baseURI;
  const contentRoot = document.getElementById("content-root");
  if (contentRoot && contentRoot.children.length > 0) {
    linkedData["articleBody"] = dom.getElementById("content-root");
  }

  return linkedData;
};

export const internalHtmlProcessor: ContentProcessor["process"] = async (
  content
) => {
  const dom = await measureAsyncTime("parse", () => blobToDocument(content));
  return { linkedData: processInternalDocument(dom) };
};
