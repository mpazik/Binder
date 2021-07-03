import { HashUri } from "../../libs/hash";
import {
  storeGet,
  StoreName,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { findUrl, isTypeEqualTo } from "../../libs/linked-data";
import { measureAsyncTime } from "../../libs/performance";
import { createLinkedDataProvider } from "../store/local-store";
import { registerRepositoryVersion } from "../store/repository";

import { createDynamicIndex2, DynamicRepoIndex } from "./dynamic-repo-index";
import { UpdateIndex } from "./types";

export type UrlQuery = { url: string };
export type UrlIndexStore = StoreProvider<string>;
export type UrlIndex = DynamicRepoIndex<UrlQuery, string>;

const urlIndexStoreName = "url-index" as StoreName;

const createSearchUrlIndex = (
  urlIndexDStore: UrlIndexStore
): UrlIndex["search"] => async ({ url }) =>
  storeGet(urlIndexDStore, url).then((hash) =>
    hash ? [{ props: url, hash: hash as HashUri }] : []
  );

const createUrlIndexer = (urlIndexStore: UrlIndexStore): UpdateIndex => {
  return async (ld) => {
    if (!isTypeEqualTo(ld, "article")) return;
    const url = findUrl(ld);
    if (!url) return;
    return storePut(urlIndexStore, ld["@id"], url).then(); // ignore storePut result
  };
};

export const createUriIndex = (): UrlIndex =>
  createDynamicIndex2(
    urlIndexStoreName,
    createSearchUrlIndex,
    createUrlIndexer
  );

registerRepositoryVersion({
  version: 3,
  stores: [{ name: urlIndexStoreName }],
  afterUpdate: (repositoryDb) => {
    const indexer = createUrlIndexer(
      repositoryDb.getStoreProvider(urlIndexStoreName)
    );
    const linkedDataProvider = createLinkedDataProvider(repositoryDb);
    return measureAsyncTime("url-indexing", async () =>
      linkedDataProvider((result) => indexer(result))
    );
  },
});
