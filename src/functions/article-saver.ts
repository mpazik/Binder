import { isHashUri } from "../libs/hash";
import { getUrls, LinkedDataWithHashId } from "../libs/linked-data";

import { LinkedDataWithDocument, articleMediaType } from "./article-processor";
import { LinkedDataStoreWrite, ResourceStoreWrite } from "./store";

export type ArticleSaver = (
  articleContent: LinkedDataWithDocument
) => Promise<LinkedDataWithHashId>;

export const createArticleSaver = (
  storeWrite: ResourceStoreWrite,
  ldStoreWrite: LinkedDataStoreWrite
): ArticleSaver => {
  return async ({ contentDocument, linkedData }) => {
    const contentBlob = new Blob([contentDocument.documentElement.innerHTML], {
      type: articleMediaType,
    });
    const contentHash = await storeWrite(contentBlob);
    const { "@id": _, ...linkedDataWithContentHashUri } = linkedData;
    linkedDataWithContentHashUri["url"] = [
      ...getUrls(linkedData).filter((uri) => !isHashUri(uri)),
      contentHash,
    ];
    return await ldStoreWrite(linkedDataWithContentHashUri);
  };
};
