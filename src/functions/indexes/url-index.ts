import { HashName } from "../../libs/hash";
import {
  storeGet,
  StoreName,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { findUrl, isTypeEqualTo } from "../../libs/linked-data";
import { measureAsyncTime } from "../../libs/performance";
import { createLinkedDataProvider } from "../store/local-store";
import { registerRepositoryVersion, RepositoryDb } from "../store/repository";

import { Index, Indexer } from "./types";

export type UrlQuery = { url: string };
export type UrlIndexStore = StoreProvider<HashName>;
export type UrlIndex = Index<UrlQuery, string>;

const urlIndexStoreName = "url-index" as StoreName;

registerRepositoryVersion({
  version: 3,
  stores: [{ name: urlIndexStoreName }],
  afterUpdate: (repositoryDb) => {
    const indexer = createUrlIndexer(createUrlIndexStore(repositoryDb));
    const linkedDataProvider = createLinkedDataProvider(repositoryDb);
    return measureAsyncTime("url-indexing", async () =>
      linkedDataProvider((result) => indexer(result))
    );
  },
});

export const createUrlIndexStore = (
  repositoryDb: RepositoryDb
): UrlIndexStore => repositoryDb.getStoreProvider(urlIndexStoreName);

export const createUrlIndex = (
  urlIndexDStore: UrlIndexStore
): UrlIndex => async ({ url }) =>
  storeGet(urlIndexDStore, url).then((hash) =>
    hash ? [{ props: url, hash }] : []
  );

export const createUrlIndexer = (urlIndexStore: UrlIndexStore): Indexer => {
  return async (ld) => {
    if (!isTypeEqualTo(ld, "article")) return;
    const url = findUrl(ld);
    if (!url) return;
    return storePut(urlIndexStore, ld["@id"], url).then(); // ignore storePut result
  };
};
