import { isHashUri } from "../libs/hash";
import { getUrls, LinkedDataWithHashId } from "../libs/linked-data";

import { articleMediaType, LinkedDataWithDocument } from "./article-processor";
import { LinkedDataStoreWrite, ResourceStoreWrite } from "./store";

export type ArticleSaver = (
  articleContent: LinkedDataWithDocument
) => Promise<LinkedDataWithHashId>;

const serializeDocument = (contentDocument: Document) => {
  const serializer = new XMLSerializer();
  return "<!DOCTYPE html>\n" + serializer.serializeToString(contentDocument);
};

export const createArticleSaver = (
  storeWrite: ResourceStoreWrite,
  ldStoreWrite: LinkedDataStoreWrite
): ArticleSaver => {
  return async ({ contentDocument, linkedData }) => {
    const contentBlob = new Blob([serializeDocument(contentDocument)], {
      type: articleMediaType,
    });
    const contentHash = await storeWrite(
      contentBlob,
      linkedData.name as string
    );
    const { "@id": _, ...linkedDataWithContentHashUri } = linkedData;
    linkedDataWithContentHashUri["url"] = [
      ...getUrls(linkedData).filter((uri) => !isHashUri(uri)),
      contentHash,
    ];
    return await ldStoreWrite(linkedDataWithContentHashUri);
  };
};
