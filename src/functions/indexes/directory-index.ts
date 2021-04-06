import { HashName } from "../../libs/hash";
import {
  openSingleStoreDb,
  SingleStoreDb,
  storeGetAllWithKeys,
  storePut,
} from "../../libs/indexeddb";
import { getPropertyValue, isTypeEqualTo } from "../../libs/linked-data";
import { Opaque } from "../../libs/types";

// import { createLinkedDataProvider } from "../linked-data-provider";
// import { LocalStoreDb } from "../local-store";
import { Indexer, IndexingStrategy, IndexRecord } from "./types";

export type DirectoryProps = { type: string; name: string };
export type DirectoryQuery = { type?: string; name?: string };
export type DirectoryRecord = IndexRecord<DirectoryProps>;
export type DirectoryIndexDb = Opaque<SingleStoreDb<DirectoryProps>>;
export type DirectoryIndex = (q: DirectoryQuery) => Promise<DirectoryRecord[]>;

export const createDirectoryIndexDb = (): // localStoreDb: LocalStoreDb
Promise<DirectoryIndexDb> =>
  openSingleStoreDb("directory-index", undefined, () => {
    return Promise.resolve();
    // const indexer = createDirectoryIndexer(db as DirectoryIndexDb);
    // const linkedDataProvider = createLinkedDataProvider(localStoreDb);
    // return measureAsyncTime("directory-indexing", async () =>
    //   linkedDataProvider((result) => indexer(result))
    // );
  }) as Promise<DirectoryIndexDb>;

export const createDirectoryIndex = (
  directoryIndexDb: DirectoryIndexDb
): DirectoryIndex => {
  return async () => {
    const data = await storeGetAllWithKeys(directoryIndexDb);
    return data.map(
      ({ key, value }) =>
        <DirectoryRecord>{
          hash: key as HashName,
          props: value,
        }
    );
  };
};

const indexer: IndexingStrategy<DirectoryProps> = (data) =>
  Promise.resolve({
    // index only first type
    type: getPropertyValue(data, "@type"),
    name: getPropertyValue(data, "name"),
  });

export const createDirectoryIndexer = (
  directoryIndexDb: DirectoryIndexDb
): Indexer => {
  return async (ld) => {
    console.log("ld to index dirs", ld);
    if (!isTypeEqualTo(ld, "article")) return;
    return indexer(ld)
      .then((props) => storePut(directoryIndexDb, props, ld["@id"]))
      .then(); // ignore storePut result
  };
};
