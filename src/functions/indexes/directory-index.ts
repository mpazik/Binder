import { HashName } from "../../libs/hash";
import {
  storeGetAllWithKeys,
  StoreName,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { getType } from "../../libs/linked-data";
import { measureAsyncTime } from "../../libs/performance";
import { createLinkedDataProvider } from "../store/local-store";
import { registerRepositoryVersion, RepositoryDb } from "../store/repository";

import { Indexer, IndexRecord } from "./types";

export type DirectoryProps = { type: string; name: string };
export type DirectoryQuery = { type?: string; name?: string };
export type DirectoryRecord = IndexRecord<DirectoryProps>;
export type DirectoryIndexStore = StoreProvider<DirectoryProps>;
export type DirectoryIndex = (q: DirectoryQuery) => Promise<DirectoryRecord[]>;

const directoryIndexStoreName = "directory-index" as StoreName;

registerRepositoryVersion({
  version: 4,
  stores: [{ name: directoryIndexStoreName }],
  afterUpdate: (repositoryDb) => {
    const indexer = createDirectoryIndexer(
      createDirectoryIndexStore(repositoryDb)
    );
    const linkedDataProvider = createLinkedDataProvider(repositoryDb);
    return measureAsyncTime("directory-indexing", async () =>
      linkedDataProvider((result) => indexer(result))
    );
  },
});

export const createDirectoryIndexStore = (
  repositoryDb: RepositoryDb
): DirectoryIndexStore =>
  repositoryDb.getStoreProvider(directoryIndexStoreName);

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
    const type = getType(ld);
    const name = ld["name"];
    if (!type || !name || typeof name != "string") return;
    const props: DirectoryProps = { name, type };
    return storePut(store, props, ld["@id"]).then(); // ignore storePut result
  };
};
