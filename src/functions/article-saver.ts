import { Article } from "schema-dts";

import { hashNameToHashUri } from "../libs/hash";
import { jsonLdMimeType, LinkedDataWithItsHash } from "../libs/linked-data";

import { ArticleContent, articleMediaType } from "./article-processor";
import { Indexer } from "./indexes/types";
import { StoreWrite } from "./local-store";

export type ArticleSaver = (
  articleContent: ArticleContent
) => Promise<LinkedDataWithItsHash<Article>>;

export const createArticleSaver = (
  storeWrite: StoreWrite,
  indexLinkedData: Indexer
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

    // await sync({
    //   metadata: {
    //     name: linkedData.name as string,
    //     mimeType: linkedData.encodingFormat,
    //   },
    //   hash: contentHashUri,
    // });

    const articleLdBlob = new Blob(
      [JSON.stringify(linkedDataWithContentHashUri)],
      {
        type: jsonLdMimeType,
      }
    );
    const articleHash = await storeWrite(articleLdBlob);
    // await sync({
    //   metadata: {
    //     mimeType: JsonLdMimeType,
    //   },
    //   hash: hashUri,
    // });

    const ldData = { hash: articleHash, ld: linkedDataWithContentHashUri };
    await indexLinkedData(ldData);
    return ldData;
  };
};
