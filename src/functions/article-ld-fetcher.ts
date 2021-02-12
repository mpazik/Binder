import { Article, URL } from "schema-dts";

import { throwIfNull } from "../libs/errors";
import { HashName, isHashUri } from "../libs/hash";
import { LinkedData, LinkedDataWithHashId } from "../libs/linked-data";

import { articleMediaType, processToArticle } from "./article-processor";
import { fetchTroughProxy } from "./fetch-trough-proxy";
import { LinkedDataStoreWrite, ResourceStoreWrite } from "./store";
import { LinkedDataStoreRead } from "./store/local-store";

export type ArticleLdFetcher = (
  uri: string,
  signal?: AbortSignal
) => Promise<LinkedDataWithHashId>;

export const createArticleLdFetcher = (
  getHash: (uri: string) => Promise<HashName | undefined>,
  linkedDataStoreRead: LinkedDataStoreRead,
  linkedDataStoreWrite: LinkedDataStoreWrite,
  resourceStoreWrite: ResourceStoreWrite
): ArticleLdFetcher => async (uri, signal) => {
  const hash = isHashUri(uri) ? uri : await getHash(uri);
  if (hash) {
    return throwIfNull(await linkedDataStoreRead(hash));
  }

  const response = await fetchTroughProxy(uri, {
    signal: signal,
  });
  const { linkedData, content } = await processToArticle(response);
  const contentHash = await resourceStoreWrite(
    new Blob([content.documentElement.innerHTML], { type: articleMediaType })
  );
  const linkedDataWithContentHashUri: LinkedData = {
    ...linkedData,
    url: [...[linkedData.url || []].flat(), contentHash] as URL[],
  };
  return await linkedDataStoreWrite(linkedDataWithContentHashUri);
};
