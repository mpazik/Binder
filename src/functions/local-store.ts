import { hashBlob, HashName } from "../libs/hash";
import {
  openSingleStoreDb,
  SingleStoreDb,
  storeGet,
  storePut,
} from "../libs/indexeddb";
import { Opaque } from "../libs/types";

export type StoreRead = (hash: HashName) => Promise<Blob | undefined>;
export type StoreWrite = (data: Blob) => Promise<HashName>;
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
