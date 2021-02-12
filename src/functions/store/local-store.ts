import { asyncLoop } from "../../libs/async-pool";
import {
  hashBlob,
  hashLinkedData,
  HashName,
  HashUri,
  hashUriScheme,
} from "../../libs/hash";
import {
  openSingleStoreDb,
  SingleStoreDb,
  storeGet,
  storeGetNext,
  storeIterate,
  StoreName,
  storePut,
} from "../../libs/indexeddb";
import { LinkedData, LinkedDataWithHashId } from "../../libs/linked-data";
import { Opaque } from "../../libs/types";

export type LocalStoreDb = Opaque<SingleStoreDb<Blob>>;
export const createLocalStoreDb = (): Promise<LocalStoreDb> =>
  openSingleStoreDb("storage") as Promise<LocalStoreDb>;

export type ResourceStoreRead = (hash: HashName) => Promise<Blob | undefined>;
export type ResourceStoreWrite = (
  data: Blob,
  name?: string
) => Promise<HashUri>;

const resourcesStore = "resources" as StoreName;

export const createLocalResourceStoreRead = (
  storageDb: LocalStoreDb
): ResourceStoreRead => {
  return async (hash: HashName) => storeGet(storageDb, hash, resourcesStore);
};

export const createLocalResourceStoreWrite = (
  storageDb: LocalStoreDb
): ResourceStoreWrite => async (blob: Blob) => {
  const hash = await hashBlob(blob);
  await storePut(storageDb, blob, hash, resourcesStore);
  return hash;
};

export type LinkedDataStoreRead = (
  hash: HashUri
) => Promise<LinkedDataWithHashId | undefined>;
export type LinkedDataStoreWrite = (
  jsonld: LinkedData
) => Promise<LinkedDataWithHashId>;
export type LinkedDataStoreIterate = (
  handler: (hashUri: HashUri) => void
) => Promise<void>;

const linkedDateStore = "linked-data" as StoreName;

export const createLocalLinkedDataStoreRead = (
  storageDb: LocalStoreDb
): LinkedDataStoreRead => {
  return async (hash: HashName) => storeGet(storageDb, hash, linkedDateStore);
};

export const createLocalLinkedDataStoreWrite = (
  storageDb: LocalStoreDb
): LinkedDataStoreWrite => async (jsonld: LinkedData) => {
  const { ...linkedDataToHash } = jsonld;
  const oldId = linkedDataToHash["@id"];
  if (oldId && !oldId.startsWith(hashUriScheme)) {
    throw new Error(
      "Linked data already have Id, saving operation would remove it"
    );
  }
  delete linkedDataToHash["@id"]; // remove id as we would replace it
  const hashUri = await hashLinkedData(linkedDataToHash);
  if (oldId && oldId !== hashUri) {
    throw new Error(`Filed ${oldId} is corrupted`);
  }
  linkedDataToHash["@id"] = hashUri;
  await storePut(storageDb, linkedDataToHash, hashUri, linkedDateStore);
  return linkedDataToHash as LinkedDataWithHashId;
};

export const createLocalLinkedDataStoreIterate = (
  storageDb: LocalStoreDb
): LinkedDataStoreIterate => (handler) =>
  storeIterate(
    storageDb,
    handler as (hash: IDBValidKey) => void,
    linkedDateStore
  );

export const createLinkedDataProvider = (
  localStoreDb: LocalStoreDb
): ((push: (ld: LinkedDataWithHashId) => Promise<void>) => Promise<void>) => {
  let lastHash: HashUri | undefined;
  return async (push) =>
    await asyncLoop(async () => {
      const result = await storeGetNext<LinkedDataWithHashId>(
        localStoreDb,
        linkedDateStore,
        lastHash
      );
      if (!result) {
        return true;
      }
      lastHash = result.key as HashUri;
      await push(result.value);
    });
};
