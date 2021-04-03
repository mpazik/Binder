import { throwIfNull } from "../libs/errors";
import { HashName, isHashUri } from "../libs/hash";
import { findHashUri, LinkedData } from "../libs/linked-data";
import { measureAsyncTime } from "../libs/performance";

import {
  LinkedDataWithContent,
  processResponseToArticle,
} from "./article-processor";
import { Fetch } from "./fetch-trough-proxy";
import { LinkedDataStoreRead, ResourceStoreRead } from "./store/local-store";

export type LinkedDataWithDocumentFetcher = (
  uri: string,
  signal?: AbortSignal
) => Promise<LinkedDataWithContent>;

type LinkedDataContentFetcher = (
  linkedData: LinkedData,
  signal?: AbortSignal
) => Promise<Blob>;

const createLinkedDataContentFetcher = (
  storeRead: ResourceStoreRead
): LinkedDataContentFetcher => (article) => {
  const hashUri = throwIfNull(findHashUri(article));
  return measureAsyncTime("read stored", () =>
    storeRead(hashUri)
  ).then((blob) =>
    throwIfNull(blob, () => `Could not find content for uri: '${hashUri}'`)
  );
};

export const createLinkedDataWithDocumentFetcher = (
  getHash: (uri: string) => Promise<HashName | undefined>,
  fetchTroughProxy: Fetch,
  linkedDataStoreRead: LinkedDataStoreRead,
  resourceStoreRead: ResourceStoreRead
): LinkedDataWithDocumentFetcher => {
  const linkedDataContentFetcher = createLinkedDataContentFetcher(
    resourceStoreRead
  );

  return async (url: string, signal?: AbortSignal) => {
    const hash = isHashUri(url) ? url : await getHash(url);
    if (hash) {
      const linkedData = throwIfNull(await linkedDataStoreRead(hash));
      const content = await linkedDataContentFetcher(linkedData, signal);

      return {
        linkedData,
        content,
      };
    }

    const response = await fetchTroughProxy(url, {
      signal,
    });
    return processResponseToArticle(response, url);
  };
};
