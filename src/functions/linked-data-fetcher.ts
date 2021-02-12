import { throwIfNull } from "../libs/errors";
import { HashName, hashUriToHashName, isHashUri } from "../libs/hash";
import { findHashUri, LinkedData } from "../libs/linked-data";
import { measureAsyncTime } from "../libs/performance";

import {
  LinkedDataWithDocument,
  parseArticleContent,
  processToArticle,
} from "./article-processor";
import { fetchTroughProxy } from "./fetch-trough-proxy";
import { LinkedDataStoreRead, ResourceStoreRead } from "./store/local-store";

export type LinkedDataWithDocumentFetcher = (
  uri: string,
  signal?: AbortSignal
) => Promise<LinkedDataWithDocument>;

type LinkedDataDocumentFetcher = (
  linkedData: LinkedData,
  signal?: AbortSignal
) => Promise<Document>;

const createLinkedDataDocumentFetcher = (
  storeRead: ResourceStoreRead
): LinkedDataDocumentFetcher => async (article) => {
  const hashUri = throwIfNull(findHashUri(article));

  // todo this won't work in the new world
  return await measureAsyncTime("read stored", async () => {
    const contentBlob: Blob = await throwIfNull(
      await storeRead(hashUri),
      () => `Could not find content for uri: '${hashUri}'`
    );
    return parseArticleContent(await contentBlob.text());
  });
};

export const createLinkedDataWithDocumentFetcher = (
  getHash: (uri: string) => Promise<HashName | undefined>,
  linkedDataStoreRead: LinkedDataStoreRead,
  resourceStoreRead: ResourceStoreRead
): LinkedDataWithDocumentFetcher => {
  const linkedDataDocumentFetcher = createLinkedDataDocumentFetcher(
    resourceStoreRead
  );

  return async (uri: string, signal?: AbortSignal) => {
    const hash = isHashUri(uri) ? uri : await getHash(uri);
    if (hash) {
      const linkedData = throwIfNull(await linkedDataStoreRead(hash));
      const contentDocument = await linkedDataDocumentFetcher(
        linkedData,
        signal
      );

      return {
        linkedData,
        contentDocument,
      };
    }

    const response = await fetchTroughProxy(uri, {
      signal,
    });
    return processToArticle(response);
  };
};
