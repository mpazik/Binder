import { Article } from "schema-dts";

import { throwIfNull } from "../libs/errors";
import {
  HashName,
  hashNameToHashUri,
  hashUriToHashName,
  isHashUri,
} from "../libs/hash";
import { LinkedDataWithItsHash } from "../libs/linked-data";

import { articleMediaType, processToArticle } from "./article-processor";
import { fetchTroughProxy } from "./fetch-trough-proxy";
import { StoreRead, StoreWrite, StoreWriteLinkedData } from "./store";

export type ArticleLdFetcher = (
  uri: string,
  signal?: AbortSignal
) => Promise<LinkedDataWithItsHash<Article>>;

export const createArticleLdFetcher = (
  getHash: (uri: string) => Promise<HashName | undefined>,
  storeRead: StoreRead,
  storeWrite: StoreWrite,
  lsStoreWrite: StoreWriteLinkedData
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
    const articleHash = await lsStoreWrite(linkedDataWithContentHashUri);
    return { hash: articleHash, ld: linkedDataWithContentHashUri };
  };
};
