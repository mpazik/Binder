import { throwIfNull } from "../../libs/errors";
import { HashName } from "../../libs/hash";
import {
  openSingleStoreDb,
  SingleStoreDb,
  storeGet,
  storePut,
} from "../../libs/indexeddb";
import { findUri } from "../../libs/linked-data";
import { Opaque } from "../../libs/types";
// import { createLinkedDataProvider } from "../linked-data-provider";
// import { LocalStoreDb } from "../local-store";

import { Index, Indexer, IndexingStrategy } from "./types";

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

const indexer: IndexingStrategy<Url> = (data) =>
  Promise.resolve(throwIfNull(findUri(data)));

export const createUrlIndexer = (urlIndexDb: UrlIndexDb): Indexer => {
  return async ({ ld, hash }) => {
    return indexer(ld)
      .then((url) => storePut(urlIndexDb, hash, url))
      .then(); // ignore storePut result
  };
};
