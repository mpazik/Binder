import { Article } from "schema-dts";

import { throwIfNull } from "../libs/errors";
import {
  HashName,
  hashNameToHashUri,
  hashUriToHashName,
  isHashUri,
} from "../libs/hash";
import { jsonLdMimeType, LinkedDataWithItsHash } from "../libs/linked-data";

import { articleMediaType, processToArticle } from "./article-processor";
import { fetchTroughProxy } from "./fetch-trough-proxy";
import { Indexer } from "./indexes/types";
import { StoreRead, StoreWrite } from "./local-store";

export type ArticleLdFetcher = (
  uri: string,
  signal?: AbortSignal
) => Promise<LinkedDataWithItsHash<Article>>;

export const createArticleLdFetcher = (
  getHash: (uri: string) => Promise<HashName | undefined>,
  storeRead: StoreRead,
  storeWrite: StoreWrite,
  indexLinkedData: Indexer
): ArticleLdFetcher => {
  return async (uri, signal) => {
    const hash = isHashUri(uri) ? hashUriToHashName(uri) : await getHash(uri);
    if (hash) {
      return {
        ld: JSON.parse(await throwIfNull(await storeRead(hash)).text()),
        hash,
      };
    }

    const response = await fetchTroughProxy(uri, {
      signal: signal,
    });
    const { linkedData, content } = await processToArticle(response);
    const contentHash = await storeWrite(
      new Blob([content.documentElement.innerHTML], { type: articleMediaType })
    );
    const linkedDataWithContentHashUri: Article = {
      ...linkedData,
      url: [...[linkedData.url || []].flat(), hashNameToHashUri(contentHash)],
    };
    const articleHash = await storeWrite(
      new Blob([JSON.stringify(linkedDataWithContentHashUri)], {
        type: jsonLdMimeType,
      })
    );

    const ldData = { hash: articleHash, ld: linkedDataWithContentHashUri };
    await indexLinkedData(ldData);
    return ldData;
  };
};
