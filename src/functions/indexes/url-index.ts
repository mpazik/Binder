import { HashName } from "../../libs/hash";
import {
  createStoreProvider,
  defaultStoreName,
  openSingleStoreDb,
  storeGet,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { findUrl, isTypeEqualTo } from "../../libs/linked-data";

import { Index, Indexer } from "./types";

export type UrlQuery = { url: string };
export type UrlIndexStore = StoreProvider<HashName>;
export type UrlIndex = Index<UrlQuery, string>;

export const createUrlIndexStore = (): // localStoreDb: LocalStoreDb
Promise<UrlIndexStore> =>
  openSingleStoreDb("url-index", undefined, () => {
    return Promise.resolve();
    // const indexer = createUrlIndexer(db as UrlIndexDb);
    // const linkedDataProvider = createLinkedDataProvider(localStoreDb);
    // return measureAsyncTime("url-indexing", async () =>
    //   linkedDataProvider((result) => indexer(result))
    // );
  }).then((db) =>
    createStoreProvider(db, defaultStoreName)
  ) as Promise<UrlIndexStore>;

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
