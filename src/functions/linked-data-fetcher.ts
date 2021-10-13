import { throwIfNull } from "../libs/errors";
import type { HashName } from "../libs/hash";
import { isHashUri } from "../libs/hash";
import type { LinkedData } from "../libs/jsonld-format";
import { findHashUri } from "../libs/linked-data";

import type { LinkedDataWithContent } from "./content-processors";
import { processResponseToContent } from "./content-processors";
import type { Fetch } from "./fetch-trough-proxy";
import type {
  LinkedDataStoreRead,
  ResourceStoreRead,
} from "./store/local-store";

export type LinkedDataWithContentFetcher = (
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
  return storeRead(hashUri).then((blob) =>
    throwIfNull(blob, () => `Could not find content for uri: '${hashUri}'`)
  );
};

export const createLinkedDataWithDocumentFetcher = (
  getHash: (uri: string) => Promise<HashName | undefined>,
  fetchTroughProxy: Fetch,
  linkedDataStoreRead: LinkedDataStoreRead,
  resourceStoreRead: ResourceStoreRead
): LinkedDataWithContentFetcher => {
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
    return processResponseToContent(response, url);
  };
};
