import { isHashUri } from "../libs/hash";
import { getUrls } from "../libs/linked-data";

import {
  articleMediaType,
  LinkedDataWithContent,
  SavedLinkedDataWithContent,
} from "./article-processor";
import { LinkedDataStoreWrite, ResourceStoreWrite } from "./store";

export type ContentSaver = (
  data: LinkedDataWithContent
) => Promise<SavedLinkedDataWithContent>;

const serializeDocument = (contentDocument: Document) => {
  const serializer = new XMLSerializer();
  return "<!DOCTYPE html>\n" + serializer.serializeToString(contentDocument);
};

export const documentToBlob = (content: Document): Blob =>
  new Blob([serializeDocument(content)], {
    type: articleMediaType,
  });

export const createContentSaver = (
  storeWrite: ResourceStoreWrite,
  ldStoreWrite: LinkedDataStoreWrite
): ContentSaver => {
  return async ({ content, linkedData }) => {
    const contentHash = await storeWrite(content, linkedData.name as string);
    const { "@id": _, ...linkedDataWithContentHashUri } = linkedData;
    linkedDataWithContentHashUri["url"] = [
      ...getUrls(linkedData).filter((uri) => !isHashUri(uri)),
      contentHash,
    ];
    return {
      linkedData: await ldStoreWrite(linkedDataWithContentHashUri),
      content,
    };
  };
};
