import { asyncLoop } from "../../libs/async-pool";
import { HashUri } from "../../libs/hash";
import {
  storeDelete,
  storeGetNext,
  StoreName,
  StoreProvider,
} from "../../libs/indexeddb";
import { LinkedData, LinkedDataWithHashId } from "../../libs/jsonld-format";
import {
  createDynamicStoreProvider,
  DynamicStoreProvider,
} from "../indexes/dynamic-repo-index";

import { registerRepositoryVersion, RepositoryDb } from "./repository";

const resourcesStoreName = "resources" as StoreName;
const linkedDataStoreName = "linked-data" as StoreName;
export type LinkedDataStore = StoreProvider<LinkedDataWithHashId>;

registerRepositoryVersion({
  version: 1,
  stores: [{ name: resourcesStoreName }, { name: linkedDataStoreName }],
});

export const getResourceStore = (
  repositoryDb: RepositoryDb
): StoreProvider<Blob> => repositoryDb.getStoreProvider(resourcesStoreName);

export const createLinkedDataStore = (
  repositoryDb: RepositoryDb
): LinkedDataStore => repositoryDb.getStoreProvider(linkedDataStoreName);

export const createDynamicLinkedDataStore = (): DynamicStoreProvider<LinkedDataWithHashId> =>
  createDynamicStoreProvider(linkedDataStoreName);

export type ResourceStoreRead = (hash: HashUri) => Promise<Blob | undefined>;
export type ResourceStoreWrite = (
  data: Blob,
  name?: string
) => Promise<HashUri>;

export type LinkedDataStoreRead = (
  hash: HashUri
) => Promise<LinkedDataWithHashId | undefined>;

export type LinkedDataStoreWrite = (
  jsonld: LinkedData
) => Promise<LinkedDataWithHashId>;

export type LinkedDataDelete = (hash: HashUri) => Promise<void>;

export const createLinkedDataDelete = (
  store: LinkedDataStore
): LinkedDataDelete => (hash) => storeDelete(store, hash);

export type ExternalLinkedDataStoreWrite = (
  jsonld: LinkedDataWithHashId
) => Promise<void>;

export type LinkedDataStoreIterate = (
  handler: (hashUri: HashUri) => void
) => Promise<void>;

export type LinkedDataStoreReadAll = () => Promise<LinkedDataWithHashId[]>;

export const createLinkedDataProvider = (
  repositoryDb: RepositoryDb
): ((push: (ld: LinkedDataWithHashId) => Promise<void>) => Promise<void>) => {
  let lastHash: HashUri | undefined;
  return async (push) =>
    await asyncLoop(async () => {
      const result = await storeGetNext<LinkedDataWithHashId>(
        createLinkedDataStore(repositoryDb),
        lastHash
      );
      if (!result) {
        return true;
      }
      lastHash = result.key as HashUri;
      await push(result.value);
    });
};
