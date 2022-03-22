import { asyncLoop } from "../../libs/async-pool";
import type { HashUri } from "../../libs/hash";
import type { StoreName, StoreProvider } from "../../libs/indexeddb";
import {
  createStoreProvider,
  openDb,
  storeClear,
  storeGetNext,
} from "../../libs/indexeddb";
import type { LinkedDataWithHashId } from "../../libs/jsonld-format";
import { measureAsyncTime } from "../../libs/performance";
import type { DriverAccount } from "../global-db";

export type RepositoryDb = {
  getStoreProvider<T>(name: string): StoreProvider<T>;
};

type AfterUpdateHook = (repositoryDb: RepositoryDb) => Promise<void>;

type Indexer = {
  indexerCreator: <T>(
    store: StoreProvider<T>
  ) => (ld: LinkedDataWithHashId) => Promise<void>;
  storeName: StoreName;
};
type RepositoryVersionUpdate = {
  version: number;
  stores: {
    name: string;
    params?: IDBObjectStoreParameters;
    indexes?: { name: string; keyPath: string; options?: IDBIndexParameters }[];
  }[];
  afterUpdate?: AfterUpdateHook;
  index?: Indexer;
};

const linkedDataStoreName = "linked-data" as StoreName;
const createLinkedDataProvider = (
  repositoryDb: RepositoryDb
): ((push: (ld: LinkedDataWithHashId) => Promise<void>) => Promise<void>) => {
  let lastHash: HashUri | undefined;
  return async (push) =>
    await asyncLoop(async () => {
      const result = await storeGetNext<LinkedDataWithHashId>(
        repositoryDb.getStoreProvider(linkedDataStoreName),
        lastHash
      );
      if (!result) {
        return true;
      }
      lastHash = result.key as HashUri;
      await push(result.value);
    });
};

const indexData = async (
  repo: RepositoryDb,
  { indexerCreator, storeName }: Indexer
) => {
  const indexer = indexerCreator(repo.getStoreProvider(storeName));
  const linkedDataProvider = createLinkedDataProvider(repo);
  return measureAsyncTime(`${storeName}-indexing`, async () =>
    linkedDataProvider((result) => indexer(result))
  );
};

const updates: RepositoryVersionUpdate[] = [];

export const registerRepositoryVersion = (
  update: RepositoryVersionUpdate
): void => {
  const version = update.version;
  if (updates[version]) {
    throw new Error(
      `Repository update for version "${version}" was already defined`
    );
  }
  updates[version] = update;
};

export type RepositoryId = string;

export const openRepository = async (
  repositoryId: RepositoryId
): Promise<RepositoryDb> => {
  // validate updates
  if (updates.length === 0) {
    throw new Error(`There were no updates for repository`);
  }
  // we start from 1 so version 0 is undefined
  for (let version = 1; version < updates.length; version++) {
    if (updates[version] === undefined) {
      throw new Error(
        `Repository update for version "${version}" was not defined`
      );
    }
  }
  const afterCreationHooks: AfterUpdateHook[] = [];

  const currentVersion = updates.length - 1; // remove version 0 from total
  const db = await openDb(
    repositoryId,
    (db, oldVersion) => {
      for (
        let processingVersion = oldVersion + 1;
        processingVersion <= currentVersion;
        processingVersion++
      ) {
        console.log(
          `Processing repository update number "${processingVersion}"`
        );
        const { stores, afterUpdate, index } = updates[processingVersion];
        stores.forEach(({ name, params, indexes }) => {
          const store = db.createObjectStore(name, params);
          (indexes ?? []).forEach(({ name: indexName, keyPath, options }) => {
            store.createIndex(indexName, keyPath, options);
          });
        });
        if (index) {
          afterCreationHooks.push((repositoryDb) =>
            indexData(repositoryDb, index)
          );
        }
        if (afterUpdate) {
          afterCreationHooks.push(afterUpdate);
        }
      }
    },
    currentVersion
  );

  const binderIndexes: { [index: string]: () => void } = {};
  updates.forEach(({ index }) => {
    if (!index) return;
    binderIndexes[index.storeName] = () => {
      console.log("indexing", index.storeName);
      const store = repo.getStoreProvider(index.storeName);
      storeClear(store);
      indexData(repo, index);
    };
  });

  // @ts-ignore
  global.reindex = binderIndexes;

  // export close method and is closing?
  const repo: RepositoryDb = {
    getStoreProvider: <T>(name: string) => createStoreProvider<T>(db, name),
  };

  for (const hook of afterCreationHooks) {
    await hook(repo);
  }

  return repo;
};

export type UnclaimedRepositoryDb = RepositoryDb;
const unclaimedRepositoryName = "unclaimed";

export const openUnclaimedRepository = (): Promise<UnclaimedRepositoryDb> =>
  openRepository(unclaimedRepositoryName);

const getAccountRepositoryName = ({ driver, email }: DriverAccount): string =>
  `${driver}-${email}`;

export const openAccountRepository = (
  account: DriverAccount
): Promise<RepositoryDb> => openRepository(getAccountRepositoryName(account));
