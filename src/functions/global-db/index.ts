import type { StoreName, StoreProvider } from "../../libs/indexeddb";
import {
  createStoreProvider,
  openDb,
  storeGet,
  transactionToPromise,
} from "../../libs/indexeddb";

const settingsStoreName = "settings" as StoreName;
export type SettingsStore = StoreProvider<string>;

export type GlobalDb = IDBDatabase;
export const openGlobalDb = (): Promise<GlobalDb> =>
  openDb(
    "global",
    (db, oldVersion) => {
      if (oldVersion < 1) {
        db.createObjectStore(settingsStoreName);
      }
    },
    1
  ) as Promise<GlobalDb>;

export const createSettingsStore = (globalDb: GlobalDb): SettingsStore =>
  createStoreProvider(globalDb, settingsStoreName);

export type DriverAccount = {
  driver: "gdrive";
  email: string;
  name: string;
};

export type OptionalDriverAccount = DriverAccount | undefined;
export type LastLogin = DriverAccount & {
  loggedIn: Date;
  connected: Date;
};

export const setLastLogin = (
  db: GlobalDb,
  account: DriverAccount,
  date: Date = new Date()
): Promise<void> => {
  const transaction = db.transaction(settingsStoreName, "readwrite");
  const store = transaction.objectStore(settingsStoreName);
  store.put(account.driver, "account.driver");
  store.put(account.email, "account.email");
  store.put(account.name, "account.name");
  store.put(date.toISOString(), "account.logged");
  store.put(date.toISOString(), "account.connected");
  return transactionToPromise(transaction);
};

export const clearLastLogin = (db: GlobalDb): Promise<void> => {
  const transaction = db.transaction(settingsStoreName, "readwrite");
  const store = transaction.objectStore(settingsStoreName);
  store.delete("account.driver");
  store.delete("account.email");
  store.delete("account.name");
  store.delete("account.logged");
  store.delete("account.connected");
  return transactionToPromise(transaction);
};

export const setLastConnected = (
  db: GlobalDb,
  date: Date = new Date()
): Promise<void> => {
  const transaction = db.transaction(settingsStoreName, "readwrite");
  const store = transaction.objectStore(settingsStoreName);
  store.put(date.toISOString(), "account.connected");
  return transactionToPromise(transaction);
};

export const getLastLogin = async (
  db: GlobalDb
): Promise<LastLogin | undefined> => {
  const store = createSettingsStore(db);
  const [driver, email, name, logged, connected] = await Promise.all([
    storeGet<string>(store, "account.driver"),
    storeGet<string>(store, "account.email"),
    storeGet<string>(store, "account.name"),
    storeGet<number>(store, "account.logged"),
    storeGet<string>(store, "account.connected"),
  ]);

  if (
    driver === undefined ||
    email === undefined ||
    logged === undefined ||
    connected === undefined ||
    name === undefined
  ) {
    return undefined;
  }

  if (driver !== "gdrive") {
    throw new Error(
      `Only "gdrive" is a supported repository driver, was: "${driver}"`
    );
  }
  return {
    driver,
    email,
    name,
    loggedIn: new Date(logged),
    connected: new Date(connected),
  };
};
