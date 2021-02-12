import { LocalStoreDb } from "../functions/store/local-store";

import { Opaque } from "./types";

export const openDb = (
  dbName: string,
  onupgradeneeded: (event: Event) => void,
  version: number
): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const openReq = indexedDB.open(dbName, version);
    openReq.onerror = () => reject(openReq.error);
    openReq.onsuccess = () => resolve(openReq.result);
    openReq.onupgradeneeded = onupgradeneeded;
  });

export type StoreName = Opaque<string>;
export const defaultStoreName = "store" as StoreName;

export type SingleStoreDb<T> = IDBDatabase;

export const openSingleStoreDb = async <T>(
  dbName: string,
  params?: IDBObjectStoreParameters,
  onCreation?: (db: SingleStoreDb<T>) => Promise<void>
): Promise<SingleStoreDb<T>> => {
  let promise: Promise<void> | undefined = undefined;
  const db = await openDb(
    dbName,
    (event) => {
      const db = (event.target as IDBRequest<IDBDatabase>)?.result;
      db.createObjectStore(defaultStoreName, params);
      promise = onCreation?.(db);
    },
    1
  );
  promise ? await promise : undefined;
  return db;
};

export const getStore = (
  db: IDBDatabase,
  storeNames: string,
  write = false
): IDBObjectStore => {
  return db
    .transaction(storeNames, write ? "readwrite" : "readonly")
    .objectStore(storeNames);
};

export const getDefaultStore = <T>(
  db: SingleStoreDb<T>,
  write = false
): IDBObjectStore => {
  return db
    .transaction(defaultStoreName, write ? "readwrite" : "readonly")
    .objectStore(defaultStoreName);
};

export const reqToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });

export const storePut = <T>(
  db: SingleStoreDb<T>,
  value: T,
  key?: IDBValidKey,
  storeName: StoreName = defaultStoreName
): Promise<IDBValidKey> =>
  reqToPromise(getStore(db, storeName, true).put(value, key));

export const storeGet = <T>(
  db: SingleStoreDb<T>,
  query: IDBValidKey | IDBKeyRange,
  storeName: StoreName = defaultStoreName
): Promise<T | undefined> => reqToPromise(getStore(db, storeName).get(query));

export const storeIterate = <T>(
  db: SingleStoreDb<T>,
  handler: (key: IDBValidKey) => void,
  storeName: StoreName = defaultStoreName
): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = getStore(db, storeName).openCursor();
    request.onerror = reject;
    request.onsuccess = function (event) {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
        .result;
      if (cursor) {
        handler(cursor.primaryKey);
        cursor.continue();
      } else {
        resolve();
      }
    };
  });

export const storeGetAll = <T>(
  db: SingleStoreDb<T>,
  query?: IDBValidKey | IDBKeyRange,
  storeName: StoreName = defaultStoreName
): Promise<T[]> => reqToPromise(getStore(db, storeName).getAll(query));

export const storeGetAllWithKeys = <T>(
  db: SingleStoreDb<T>,
  query?: IDBValidKey | IDBKeyRange,
  storeName: StoreName = defaultStoreName
): Promise<{ key: IDBValidKey; value: T }[]> =>
  new Promise((resolve, reject) => {
    const request = getStore(db, storeName).openCursor();
    const data: { key: IDBValidKey; value: T }[] = [];
    request.onerror = reject;
    request.onsuccess = function (event) {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
        .result;
      if (cursor) {
        const key = cursor.primaryKey;
        const value = cursor.value;
        data.push({ key, value });
        cursor.continue();
      } else {
        resolve(data);
      }
    };
  });

export const storeGetFirst = <T>(
  db: IDBDatabase,
  storeName: string
): Promise<{ key: IDBValidKey; value: T } | undefined> =>
  new Promise((resolve, reject) => {
    const request = getStore(db, storeName).openCursor();
    request.onerror = reject;
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
        .result;
      if (cursor) {
        resolve({ key: cursor.key, value: cursor.value });
      } else {
        resolve(undefined);
      }
    };
  });

export const storeGetNext = <T>(
  db: LocalStoreDb,
  storeName: string,
  previous?: IDBValidKey
): Promise<{ key: IDBValidKey; value: T } | undefined> =>
  new Promise((resolve, reject) => {
    const request = getStore(db, storeName).openCursor(
      previous ? IDBKeyRange.lowerBound(previous, true) : undefined
    );
    request.onerror = reject;
    request.onsuccess = async (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
        .result;
      if (cursor) {
        resolve({ key: cursor.key, value: cursor.value });
      } else {
        resolve(undefined);
      }
    };
  });

export const storeDelete = (
  db: SingleStoreDb<unknown>,
  query: IDBValidKey | IDBKeyRange,
  storeName: StoreName = defaultStoreName
): Promise<undefined> =>
  reqToPromise(getStore(db, storeName, true).delete(query));

export const storeClear = (
  db: SingleStoreDb<unknown>,
  storeName: StoreName = defaultStoreName
): Promise<undefined> => reqToPromise(getStore(db, storeName, true).clear());
