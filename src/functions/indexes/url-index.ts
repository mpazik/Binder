import { HashName } from "../../libs/hash";
import {
  openSingleStoreDb,
  SingleStoreDb,
  storeGet,
  storePut,
} from "../../libs/indexeddb";
import { findUrl, isTypeEqualTo } from "../../libs/linked-data";
import { Opaque } from "../../libs/types";

import { Index, Indexer } from "./types";

export type Url = string;
export type UrlQuery = { url: string };
export type UrlIndexDb = Opaque<SingleStoreDb<HashName>>;
export type UrlIndex = Index<UrlQuery, string>;

export const createUrlIndexDb = (): // localStoreDb: LocalStoreDb
Promise<UrlIndexDb> =>
  openSingleStoreDb("url-index", undefined, (db) => {
    return Promise.resolve();
    // const indexer = createUrlIndexer(db as UrlIndexDb);
    // const linkedDataProvider = createLinkedDataProvider(localStoreDb);
    // return measureAsyncTime("url-indexing", async () =>
    //   linkedDataProvider((result) => indexer(result))
    // );
  }) as Promise<UrlIndexDb>;

export const createUrlIndex = (urlIndexDb: UrlIndexDb): UrlIndex => async ({
  url,
}) =>
  storeGet<HashName>(urlIndexDb, url).then((hash) =>
    hash ? [{ props: url, hash }] : []
  );

export const createUrlIndexer = (urlIndexDb: UrlIndexDb): Indexer => {
  return async (ld) => {
    if (!isTypeEqualTo(ld, "article")) return;
    const url = findUrl(ld);
    if (!url) return;
    return storePut(urlIndexDb, ld["@id"], url).then(); // ignore storePut result
  };
};
