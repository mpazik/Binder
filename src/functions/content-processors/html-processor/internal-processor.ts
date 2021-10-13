import { pick, pipe } from "linki";

import { throwIfUndefined } from "../../../libs/errors";
import type { LinkedData } from "../../../libs/jsonld-format";
import { htmlMediaType } from "../../../libs/ld-schemas";
import { measureTime } from "../../../libs/performance";
import type { ContentProcessor } from "../types";

export const processInternalDocument = (dom: Document): LinkedData => {
  const jsonLdScripts = dom.querySelectorAll(
    'script[type="application/ld+json"]'
  );

  const jsonLds = Array.from(jsonLdScripts).map(
    pipe(pick("innerHTML"), JSON.parse)
  );

  const linkedData = jsonLds[0];
  throwIfUndefined(linkedData);

  return linkedData;
};

export const internalHtmlProcessor: ContentProcessor["process"] = async (
  content
) => {
  const text = await content.text();
  const domParser = new DOMParser();
  const dom = measureTime("parse", () =>
    domParser.parseFromString(text, htmlMediaType)
  );
  return { content, linkedData: processInternalDocument(dom) };
};
