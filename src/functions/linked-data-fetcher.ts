import { getIntervalData } from "../libs/calendar-ld";
import { throwIfNull } from "../libs/errors";
import type { HashName } from "../libs/hash";
import { isHashUri } from "../libs/hash";
import type { LinkedData } from "../libs/jsonld-format";
import { findHashUri, getType } from "../libs/linked-data";

import { processResponseToContent } from "./content-processors";
import type { ContentSaver } from "./content-saver";
import type { Fetch } from "./fetch-trough-proxy";
import type {
  LinkedDataStoreRead,
  ResourceStoreRead,
} from "./store/local-store";

export type LinkedDataFetcher = (
  uri: string,
  signal?: AbortSignal
) => Promise<LinkedData>;

type LinkedDataContentFetcher = (
  linkedData: LinkedData,
  signal?: AbortSignal
) => Promise<Blob>;

export const createLinkedDataContentFetcher = (
  storeRead: ResourceStoreRead
): LinkedDataContentFetcher => (article) => {
  const hashUri = throwIfNull(findHashUri(article));
  return storeRead(hashUri).then((blob) =>
    throwIfNull(blob, () => `Could not find content for uri: '${hashUri}'`)
  );
};

type BuildInFetcher = (uri: string) => LinkedData | undefined;
const intervalFetcher: BuildInFetcher = (uri) => {
  const data = getIntervalData(uri);
  if (data) {
    return data;
  }
};
const buildInFetchers = [intervalFetcher];
const fetchFromBuildInFetchers: BuildInFetcher = (uri) => {
  for (const fetcher of buildInFetchers) {
    const result = fetcher(uri);
    if (result) return result;
  }
};

const typeToSave = ["Article", "Book"];

export const createLinkedDataWithDocumentFetcher = (
  getHash: (uri: string) => Promise<HashName | undefined>,
  fetchTroughProxy: Fetch,
  linkedDataStoreRead: LinkedDataStoreRead,
  resourceStoreRead: ResourceStoreRead,
  contentSaver: ContentSaver
): LinkedDataFetcher => {
  return async (url: string, signal?: AbortSignal) => {
    const data = fetchFromBuildInFetchers(url);
    if (data) return data;

    const hash = isHashUri(url) ? url : await getHash(url);
    if (hash) {
      return throwIfNull(await linkedDataStoreRead(hash));
    }
    const response = await fetchTroughProxy(url, {
      signal,
    });
    const content = await processResponseToContent(response, url);

    const contentType = getType(content.linkedData);
    if (contentType && typeToSave.includes(contentType)) {
      return (await contentSaver(content)).linkedData;
    }
    return content.linkedData;
  };
};
