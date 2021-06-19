import { Opaque } from "./types";

export const openDb = (
  dbName: string,
  onupgradeneeded: (db: IDBDatabase, oldVersion: number) => void,
  version: number
): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const openReq = indexedDB.open(dbName, version);
    openReq.onerror = () => reject(openReq.error);
    openReq.onsuccess = () => resolve(openReq.result);
    openReq.onupgradeneeded = (event) => {
      onupgradeneeded(openReq.result, event.oldVersion);
    };
  });

export type StoreName = Opaque<string>;
export const defaultStoreName = "store" as StoreName;

// eslint-disable-next-line unused-imports/no-unused-vars-ts,@typescript-eslint/no-unused-vars
export type SingleStoreDb<T> = IDBDatabase;
export type StoreDb = IDBDatabase;

export const openSingleStoreDb = async <T>(
  dbName: string,
  params?: IDBObjectStoreParameters,
  onCreation?: (
    db: SingleStoreDb<T>,
    stores: Map<string, IDBObjectStore>
  ) => Promise<void>
): Promise<SingleStoreDb<T>> =>
  openStoreDb(dbName, [{ name: defaultStoreName, params }], onCreation);

export const openStoreDb = async (
  dbName: string,
  stores: { name: string; params?: IDBObjectStoreParameters }[],
  onCreation?: (
    db: StoreDb,
    stores: Map<string, IDBObjectStore>
  ) => Promise<void>
): Promise<StoreDb> => {
  let promise: Promise<void> | undefined = undefined;
  const db = await openDb(
    dbName,
    (db) => {
      const objectStores = stores.map(({ name, params }) => {
        const objectStore = db.createObjectStore(name, params);
        return [name, objectStore] as [string, IDBObjectStore];
      });
      promise = onCreation?.(db, new Map(objectStores));
    },
    1
  );
  // block till on creation handler is finished.
  // Can not wait within the db transaction
  promise ? await promise : undefined;
  return db;
};

// eslint-disable-next-line unused-imports/no-unused-vars-ts,@typescript-eslint/no-unused-vars
export type Store<T> = IDBObjectStore;
export type StoreProvider<T> = (write: boolean | void) => Store<T>;

export const createStoreProvider = <T>(
  db: IDBDatabase,
  storeName: string
): StoreProvider<T> => (write) =>
  db
    .transaction(storeName, write ? "readwrite" : "readonly")
    .objectStore(storeName);

export const reqToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });

export const storeGet = <T>(
  getStore: StoreProvider<T>,
  query: IDBValidKey | IDBKeyRange
): Promise<T | undefined> => reqToPromise(getStore().get(query));

export const storePut = <T>(
  getStore: StoreProvider<T>,
  value: T,
  key?: IDBValidKey
): Promise<IDBValidKey> => reqToPromise(getStore(true).put(value, key));

export const storeIterate = <T>(
  getStore: StoreProvider<T>,
  handler: (key: IDBValidKey) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = getStore().openCursor();
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
  getStore: StoreProvider<T>,
  query?: IDBValidKey | IDBKeyRange
): Promise<T[]> => reqToPromise(getStore().getAll(query));

export const storeGetAllWithKeys = <T>(
  getStore: StoreProvider<T>
): Promise<{ key: IDBValidKey; value: T }[]> =>
  new Promise((resolve, reject) => {
    const request = getStore().openCursor();
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
  getStore: StoreProvider<T>
): Promise<{ key: IDBValidKey; value: T } | undefined> =>
  new Promise((resolve, reject) => {
    const request = getStore().openCursor();
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
  getStore: StoreProvider<T>,
  previous?: IDBValidKey
): Promise<{ key: IDBValidKey; value: T } | undefined> =>
  new Promise((resolve, reject) => {
    const request = getStore().openCursor(
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

export const storeDelete = <T>(
  getStore: StoreProvider<T>,
  query: IDBValidKey | IDBKeyRange
): Promise<undefined> => reqToPromise(getStore(true).delete(query));

export const storeClear = <T>(getStore: StoreProvider<T>): Promise<undefined> =>
  reqToPromise(getStore(true).clear());
