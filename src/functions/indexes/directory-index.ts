import { HashName } from "../../libs/hash";
import {
  createStoreProvider,
  defaultStoreName,
  openSingleStoreDb,
  storeGetAllWithKeys,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { getType } from "../../libs/linked-data";
import { measureAsyncTime } from "../../libs/performance";

import { Indexer, IndexRecord } from "./types";

export type DirectoryProps = { type: string; name: string };
export type DirectoryQuery = { type?: string; name?: string };
export type DirectoryRecord = IndexRecord<DirectoryProps>;
export type DirectoryIndexStore = StoreProvider<DirectoryProps>;
export type DirectoryIndex = (q: DirectoryQuery) => Promise<DirectoryRecord[]>;

export const createDirectoryIndexStore = (): Promise<DirectoryIndexStore> =>
  openSingleStoreDb("directory-index", undefined, () => {
    return Promise.resolve();
    // const indexer = createDirectoryIndexer(db as DirectoryIndexDb);
    // const linkedDataProvider = createLinkedDataProvider(localStoreDb);
    // return measureAsyncTime("directory-indexing", async () =>
    //   linkedDataProvider((result) => indexer(result))
    // );
  }).then((db) => createStoreProvider(db, defaultStoreName));

export const createDirectoryIndex = (
  store: DirectoryIndexStore
): DirectoryIndex => {
  return async ({ name, type }) =>
    measureAsyncTime("search", async () => {
      const data = await storeGetAllWithKeys(store);
      return data
        .map(
          ({ key, value }) =>
            <DirectoryRecord>{
              hash: key as HashName,
              props: value,
            }
        )
        .filter(
          ({ props }) =>
            (!name ||
              props.name
                .toLocaleLowerCase()
                .includes(name.toLocaleLowerCase())) &&
            (!type || props.type === type)
        );
    });
};

export const createDirectoryIndexer = (store: DirectoryIndexStore): Indexer => {
  return async (ld) => {
    console.log("ld to index dirs", ld);
    const type = getType(ld);
    const name = ld["name"];
    if (!type || !name || typeof name != "string") return;
    const props: DirectoryProps = { name, type };
    return storePut(store, props, ld["@id"]).then(); // ignore storePut result
  };
};
