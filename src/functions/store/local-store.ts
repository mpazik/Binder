import { asyncLoop } from "../../libs/async-pool";
import {
  hashBlob,
  hashLinkedData,
  HashName,
  HashUri,
  hashUriScheme,
} from "../../libs/hash";
import {
  createStoreProvider,
  openStoreDb,
  SingleStoreDb,
  storeGet,
  storeGetNext,
  storeIterate,
  StoreName,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { LinkedData, LinkedDataWithHashId } from "../../libs/linked-data";
import { Opaque } from "../../libs/types";
import { GoogleDriveDb } from "../gdrive/app-files";

const resourcesStore = "resources" as StoreName;
const linkedDataStore = "linked-data" as StoreName;

const getResourceStore = (localDb: GoogleDriveDb): StoreProvider<Blob> =>
  createStoreProvider(localDb, resourcesStore);

const getLinkedDataStore = (
  localDb: GoogleDriveDb
): StoreProvider<LinkedDataWithHashId> =>
  createStoreProvider(localDb, linkedDataStore);

export type LocalStoreDb = Opaque<SingleStoreDb<Blob>>;
export const createLocalStoreDb = (): Promise<LocalStoreDb> =>
  openStoreDb("storage", [
    { name: resourcesStore },
    { name: linkedDataStore },
  ]) as Promise<LocalStoreDb>;

export type ResourceStoreRead = (hash: HashUri) => Promise<Blob | undefined>;
export type ResourceStoreWrite = (
  data: Blob,
  name?: string
) => Promise<HashUri>;

export const createLocalResourceStoreRead = (
  storageDb: LocalStoreDb
): ResourceStoreRead => {
  return async (hash: HashUri) => {
    return storeGet(getResourceStore(storageDb), hash);
  };
};

export const createLocalResourceStoreWrite = (
  storageDb: LocalStoreDb
): ResourceStoreWrite => async (blob: Blob) => {
  const hash = await hashBlob(blob);
  await storePut(getResourceStore(storageDb), blob, hash);
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

export const createLocalLinkedDataStoreRead = (
  storageDb: LocalStoreDb
): LinkedDataStoreRead => async (hash: HashName) =>
  storeGet(getLinkedDataStore(storageDb), hash);

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
  await storePut(getLinkedDataStore(storageDb), linkedDataToHash, hashUri);
  return linkedDataToHash as LinkedDataWithHashId;
};

export const createLocalLinkedDataStoreIterate = (
  storageDb: LocalStoreDb
): LinkedDataStoreIterate => (handler) =>
  storeIterate(
    getLinkedDataStore(storageDb),
    handler as (hash: IDBValidKey) => void
  );

export const createLinkedDataProvider = (
  storageDb: LocalStoreDb
): ((push: (ld: LinkedDataWithHashId) => Promise<void>) => Promise<void>) => {
  let lastHash: HashUri | undefined;
  return async (push) =>
    await asyncLoop(async () => {
      const result = await storeGetNext<LinkedDataWithHashId>(
        getLinkedDataStore(storageDb),
        lastHash
      );
      if (!result) {
        return true;
      }
      lastHash = result.key as HashUri;
      await push(result.value);
    });
};
