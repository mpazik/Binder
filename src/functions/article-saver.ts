import { Article } from "schema-dts";

import { hashNameToHashUri } from "../libs/hash";
import { LinkedDataWithItsHash } from "../libs/linked-data";

import { ArticleContent, articleMediaType } from "./article-processor";
import { StoreWrite, StoreWriteLinkedData } from "./store";

export type ArticleSaver = (
  articleContent: ArticleContent
) => Promise<LinkedDataWithItsHash<Article>>;

export const createArticleSaver = (
  storeWrite: StoreWrite,
  ldStoreWrite: StoreWriteLinkedData
): ArticleSaver => {
  return async ({ content, linkedData }) => {
    const contentBlob = new Blob([content.documentElement.innerHTML], {
      type: articleMediaType,
    });
    const contentHash = await storeWrite(contentBlob);
    const linkedDataWithContentHashUri: Article = {
      ...linkedData,
      url: [...[linkedData.url || []].flat(), hashNameToHashUri(contentHash)],
    };
    const articleHash = await ldStoreWrite(linkedDataWithContentHashUri);
    return { hash: articleHash, ld: linkedDataWithContentHashUri };
  };
};
