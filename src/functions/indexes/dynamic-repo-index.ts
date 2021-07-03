import { throwIfUndefined } from "../../libs/errors";
import { StoreName, StoreProvider } from "../../libs/indexeddb";
import { RepositoryDb } from "../store/repository";

import { Index, SearchIndex, UpdateIndex } from "./types";

export type DynamicRepoIndex<Q, T> = Index<Q, T> & {
  switchRepo: (db: RepositoryDb) => void;
};

export type IndexCreator<Q, T> = (repositoryDb: RepositoryDb) => Index<Q, T>;

export const createDynamicIndex = <Q, T>(
  createIndex: IndexCreator<Q, T>
): DynamicRepoIndex<Q, T> => {
  let index: Index<Q, T> | undefined;

  return {
    search: (q) => throwIfUndefined(index).search(q),
    update: (ld) => throwIfUndefined(index).update(ld),
    switchRepo: (db) => {
      index = createIndex(db);
    },
  };
};

export const createDynamicIndex2 = <Q, T>(
  storeName: StoreName,
  searchCreator: (store: StoreProvider<T>) => SearchIndex<Q, T>,
  updateCreator: (store: StoreProvider<T>) => UpdateIndex
): DynamicRepoIndex<Q, T> => {
  let search: SearchIndex<Q, T> | undefined;
  let update: UpdateIndex | undefined;

  return {
    search: (q) => throwIfUndefined(search)(q),
    update: (ld) => throwIfUndefined(update)(ld),
    switchRepo: (db) => {
      const store = db.getStoreProvider(storeName);
      search = searchCreator(store);
      update = updateCreator(store);
    },
  };
};
