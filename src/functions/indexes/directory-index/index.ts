import type { HashName } from "../../../libs/hash";
import type { StoreName, StoreProvider } from "../../../libs/indexeddb";
import { storeGetAllWithKeys, storePut } from "../../../libs/indexeddb";
import { getType } from "../../../libs/linked-data";
import { measureAsyncTime } from "../../../libs/performance";
import { createLinkedDataProvider } from "../../store/local-store";
import { registerRepositoryVersion } from "../../store/repository";
import type { DynamicRepoIndex } from "../dynamic-repo-index";
import { createDynamicIndex } from "../dynamic-repo-index";
import type { IndexRecord } from "../types";

import { createQueryMatcher } from "./utils";

export type DirectoryProps = { type: string; name: string };
export type DirectoryQuery = { type?: string; name?: string };
export type DirectoryRecord = IndexRecord<DirectoryProps>;
export type DirectoryIndexStore = StoreProvider<DirectoryProps>;
export type DirectoryIndex = DynamicRepoIndex<DirectoryQuery, DirectoryProps>;

const directoryIndexStoreName = "directory-index" as StoreName;

const createSearchDirectoryIndex = (
  store: DirectoryIndexStore
): DirectoryIndex["search"] => async (query) =>
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
      .filter(createQueryMatcher(query));
  });

export const createDirectoryIndexer = (
  store: DirectoryIndexStore
): DirectoryIndex["update"] => {
  return async (ld) => {
    const type = getType(ld);
    const name = ld["name"];
    if (!type || !name || typeof name != "string") return;
    const props: DirectoryProps = { name, type };
    return storePut(store, props, ld["@id"]).then(); // ignore storePut result
  };
};

export const createDirectoryIndex = (): DirectoryIndex =>
  createDynamicIndex((repositoryDb) => {
    const store = repositoryDb.getStoreProvider(directoryIndexStoreName);
    return {
      search: createSearchDirectoryIndex(store),
      update: createDirectoryIndexer(store),
    };
  });

registerRepositoryVersion({
  version: 4,
  stores: [{ name: directoryIndexStoreName }],
  afterUpdate: (repositoryDb) => {
    const indexer = createDirectoryIndexer(
      repositoryDb.getStoreProvider(directoryIndexStoreName)
    );
    const linkedDataProvider = createLinkedDataProvider(repositoryDb);
    return measureAsyncTime("directory-indexing", async () =>
      linkedDataProvider((result) => indexer(result))
    );
  },
});
