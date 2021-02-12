import { LinkedData, LinkedDataWithHashId } from "../libs/linked-data";

import { ArticleContent, articleMediaType } from "./article-processor";
import { LinkedDataStoreWrite, ResourceStoreWrite } from "./store";

export type ArticleSaver = (
  articleContent: ArticleContent
) => Promise<LinkedDataWithHashId>;

export const createArticleSaver = (
  storeWrite: ResourceStoreWrite,
  ldStoreWrite: LinkedDataStoreWrite
): ArticleSaver => {
  return async ({ content, linkedData }) => {
    const contentBlob = new Blob([content.documentElement.innerHTML], {
      type: articleMediaType,
    });
    const contentHash = await storeWrite(contentBlob);
    const linkedDataWithContentHashUri: LinkedData = {
      ...linkedData,
      url: [...[linkedData.url || []].flat(), contentHash],
    };
    return await ldStoreWrite(linkedDataWithContentHashUri);
  };
};
