import * as JSZip from "jszip";

import { getXmlFile } from "../../libs/epub";
import { throwIfNull } from "../../libs/errors";
import { createCreativeWork, epubMediaType } from "../../libs/ld-schemas";
import { LinkedData } from "../../libs/linked-data";

import type { ContentProcessor } from "./types";
import { getLinkedDataName } from "./utils";

const getTitle = (metadata: Element): string | null => {
  const elements = Array.from(metadata.getElementsByTagName("dc:title"));
  if (elements.length === 0) {
    console.warn("Epub didn't have defined title in metadata", metadata);
    return null;
  }
  if (elements.length === 1) {
    return elements[0].textContent;
  }
  const mainTitleProp = Array.from(
    metadata.querySelectorAll("meta[property='title-type']")
  ).find((it) => it.textContent === "main");
  const mainTitleSelector = mainTitleProp?.getAttribute("refines");
  if (mainTitleSelector) {
    const mainTitle = metadata.querySelector(mainTitleSelector);
    if (mainTitle) {
      return mainTitle.textContent;
    }
  }

  return elements[0].textContent;
};

const getEpubId = (packageDoc: Document): string => {
  const packageEl = throwIfNull(packageDoc.querySelector("package"));
  const idElementId = throwIfNull(packageEl.getAttribute("unique-identifier"));
  return throwIfNull(packageDoc.getElementById(idElementId)?.textContent);
};

const getModified = (metadata: Element): string | undefined =>
  metadata.querySelector("meta[property='dcterms:modified']")?.textContent ??
  undefined;

export const epubContentProcessor: ContentProcessor = {
  mediaType: epubMediaType,
  process: async (content, { url, name }) => {
    const zip = throwIfNull(await JSZip.loadAsync(content));

    const container = await getXmlFile(zip, "META-INF/container.xml");
    const rootFile = throwIfNull(container.querySelector("rootfile"));
    const packageDoc = await getXmlFile(
      zip,
      throwIfNull(rootFile.getAttribute("full-path"))
    );

    const metadata = throwIfNull(packageDoc.querySelector("metadata"));
    const articleLd: LinkedData = createCreativeWork({
      id: getEpubId(packageDoc),
      name: getLinkedDataName(getTitle(metadata) ?? undefined, name),
      type: "Book",
      encodingFormat: epubMediaType,
      dateCreated: getModified(metadata),
      urls: url ? [url] : [],
    });

    return {
      content,
      linkedData: articleLd,
    };
  },
};
