import { getIntervalData } from "../libs/calendar-ld";
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

type BuildInFetcher = (uri: string) => LinkedDataWithContent | undefined;
const intervalFetcher: BuildInFetcher = (uri) => {
  const data = getIntervalData(uri);
  if (data) {
    return {
      linkedData: data,
      content: new Blob(),
    };
  }
};
const buildInFetchers = [intervalFetcher];
const fetchFromBuildInFetchers: BuildInFetcher = (uri) => {
  for (const fetcher of buildInFetchers) {
    const result = fetcher(uri);
    if (result) return result;
  }
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
    const data = fetchFromBuildInFetchers(url);
    if (data) return data;

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
