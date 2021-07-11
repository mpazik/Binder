import { asyncLoop } from "../../libs/async-pool";
import { HashUri } from "../../libs/hash";
import { storeGetNext, StoreName, StoreProvider } from "../../libs/indexeddb";
import { LinkedData, LinkedDataWithHashId } from "../../libs/jsonld-format";

import { registerRepositoryVersion, RepositoryDb } from "./repository";

const resourcesStoreName = "resources" as StoreName;
const linkedDataStoreName = "linked-data" as StoreName;

registerRepositoryVersion({
  version: 1,
  stores: [{ name: resourcesStoreName }, { name: linkedDataStoreName }],
});

export const getResourceStore = (
  repositoryDb: RepositoryDb
): StoreProvider<Blob> => repositoryDb.getStoreProvider(resourcesStoreName);

export const getLinkedDataStore = (
  repositoryDb: RepositoryDb
): StoreProvider<LinkedDataWithHashId> =>
  repositoryDb.getStoreProvider(linkedDataStoreName);

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
  const linkedDataStore1 = getLinkedDataStore(repositoryDb);
  let lastHash: HashUri | undefined;
  return async (push) =>
    await asyncLoop(async () => {
      const result = await storeGetNext<LinkedDataWithHashId>(
        linkedDataStore1,
        lastHash
      );
      if (!result) {
        return true;
      }
      lastHash = result.key as HashUri;
      await push(result.value);
    });
};
