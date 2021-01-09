import { CreativeWork } from "schema-dts";

import { hashBlob, HashName } from "../../libs/hash";
import {
  openSingleStoreDb,
  SingleStoreDb,
  storeGet,
  storeIterate,
  storePut,
} from "../../libs/indexeddb";
import { Opaque } from "../../libs/types";

export type StoreRead = (hash: HashName) => Promise<Blob | undefined>;
export type StoreWrite = (data: Blob, name?: string) => Promise<HashName>;
export type StoreWriteLinkedData = <LD extends CreativeWork = CreativeWork>(
  data: LD
) => Promise<HashName>;
export type StoreIterate = (handler: (hash: HashName) => void) => Promise<void>;
export type LocalStoreDb = Opaque<SingleStoreDb<Blob>>;

export const createLocalStoreDb = (): Promise<LocalStoreDb> =>
  openSingleStoreDb("storage") as Promise<LocalStoreDb>;

export const createLocalStoreRead = (
  storageDb: LocalStoreDb
): StoreRead => async (hash: HashName) => storeGet(storageDb, hash);

export const createLocalStoreWrite = (
  storageDb: LocalStoreDb
): StoreWrite => async (blob: Blob) => {
  const hash = await hashBlob(blob);
  await storePut(storageDb, blob, hash);
  return hash;
};

export const createLocalStoreIterate = (
  storageDb: LocalStoreDb
): StoreIterate => (handler) =>
  storeIterate(storageDb, handler as (hash: IDBValidKey) => void);
