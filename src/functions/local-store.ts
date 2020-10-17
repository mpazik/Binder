import { hashBlob, HashName } from "../utils/hash";
import {
  openSingleStoreDb,
  SingleStoreDb,
  storeGet,
  storePut,
} from "../utils/indexeddb";
import { Opaque } from "../utils/types";

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
