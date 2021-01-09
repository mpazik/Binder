import { Consumer, Provider } from "../../libs/connections";
import { throwIfNull } from "../../libs/errors";
import { HashName, HashUri } from "../../libs/hash";
import {
  openDb,
  storeDelete,
  storeGet,
  storeGetFirst,
  StoreName,
  storePut,
} from "../../libs/indexeddb";
import { jsonLdMimeType } from "../../libs/linked-data";
import { handleState, mapState } from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import { GDriveConfig } from "../gdrive/app-files";
import { GDriveState } from "../gdrive/controller";
import { findOrCreateFileByHash } from "../gdrive/file";
import { Indexer } from "../indexes/types";

import { createStatefulGDriveStoreRead } from "./gdrive-store-read";
import {
  createLocalStoreDb,
  createLocalStoreIterate,
  createLocalStoreRead,
  createLocalStoreWrite,
  StoreRead,
  StoreWrite,
  StoreWriteLinkedData,
} from "./local-store";
import { newMissingLinkedDataDownloader } from "./missing-linked-data-downloader";

export type {
  StoreWrite,
  StoreWriteLinkedData,
  StoreRead,
} from "./local-store";

type Index = {
  read: StoreRead;
  write: StoreWrite;
  writeLinkedData: StoreWriteLinkedData;
  updateGdriveState: (gdrive: GDriveState) => void;
  storeStateProvider: Provider<StoreState>;
};

export type BlobHashRecord = {
  name?: string;
  hash: HashUri;
};

const blobSyncRequiredStore = "sync-required-blobs" as StoreName;
const syncPropsStore = "sync-props" as StoreName;

const createSyncDb = () =>
  openDb(
    "sync-db",
    (event) => {
      const db = (throwIfNull(event.target) as IDBRequest<IDBDatabase>).result;
      db.createObjectStore(blobSyncRequiredStore, { autoIncrement: true });
      db.createObjectStore(syncPropsStore);
    },
    1
  );

export type StoreState =
  | ["idle"]
  | ["uploading", GDriveConfig]
  | ["downloading", GDriveConfig]
  | [
      "error",
      {
        config: GDriveConfig;
        error: { code: string; message: string };
        recordKey: IDBValidKey;
      }
    ]
  | ["ready", GDriveConfig];

export const createStore = async (indexLinkedData: Indexer): Promise<Index> => {
  const localStoreDb = await createLocalStoreDb();
  const localStoreRead = createLocalStoreRead(localStoreDb);
  const localStoreWrite = createLocalStoreWrite(localStoreDb);
  const syncDb = await createSyncDb();
  const [remoteStoreRead, updateGdriveState] = createStatefulGDriveStoreRead();
  let state: StoreState = ["idle"];
  let stateConsumer: Consumer<StoreState> | undefined;

  const updateState = (newState: StoreState) => {
    state = newState;
    stateConsumer?.(state);
    handleState(state, {
      downloading: async (config) => {
        const since = await storeGet<Date>(syncDb, "last-sync", syncPropsStore);
        const downloader = newMissingLinkedDataDownloader(
          createLocalStoreIterate(localStoreDb),
          localStoreWrite,
          indexLinkedData,
          config
        );
        downloader(since)
          .then(async (till) => {
            await storePut<Date>(syncDb, till, "last-sync", syncPropsStore);
          })
          .then(() => updateState(["ready", config]));
      },
    });
  };

  const uploadNext = async () => {
    const config: GDriveConfig | undefined =
      state[0] === "uploading" || state[0] === "ready" ? state[1] : undefined;
    if (config === undefined) {
      return;
    }

    const record = await storeGetFirst<BlobHashRecord>(
      syncDb,
      blobSyncRequiredStore
    );
    if (record) {
      const {
        key,
        value: { hash, name },
      } = record;
      const localBlob = await localStoreRead(hash);
      if (localBlob) {
        uploadToDrive(config, key, hash, localBlob, name);
      } else {
        updateState([
          "error",
          {
            config,
            recordKey: key,
            error: {
              code: "sync-error-read",
              message: "Error reading file from local store for upload",
            },
          },
        ]);
      }
    } else {
      updateState(["ready", config]);
    }
  };

  const uploadToDrive = (
    config: GDriveConfig,
    recordKey: IDBValidKey,
    hash: HashUri,
    blob: Blob,
    name?: string
  ) => {
    updateState(["uploading", config]);
    (async (config: GDriveConfig, hash: HashUri, blob: Blob, name?: string) => {
      await findOrCreateFileByHash(config, hash, blob, name);
    })(config, hash, blob, name)
      .then(() => {
        // check: unbound promise
        storeDelete(syncDb, recordKey, blobSyncRequiredStore);
        // call outside as we don't want to catch here uploadNext errors
        setImmediate(() => uploadNext());
      })
      .catch(() => {
        if (state[0] !== "uploading") {
          console.error("unexpected store state change");
        }
        updateState([
          "error",
          {
            config,
            recordKey,
            error: {
              code: "sync-error-upload",
              message: "Error saving file to google drive",
            },
          },
        ]);
      });
  };

  const markForSync = async (hash: HashUri, blob: Blob, name?: string) => {
    const dbKey = await storePut<BlobHashRecord>(
      syncDb,
      {
        hash,
        name,
      },
      undefined,
      blobSyncRequiredStore
    );
    if (state[0] !== "ready") return;
    uploadToDrive(state[1], dbKey, hash, blob, name);
  };

  return {
    read: async (hash) => {
      return (
        (await measureAsyncTime("read local store", () =>
          localStoreRead(hash)
        )) ??
        (await measureAsyncTime("read remote store", async () => {
          const result = await remoteStoreRead(hash);
          if (result) await localStoreWrite(result);
          return result;
        }))
      );
    },
    write: async (blob, name): Promise<HashName> => {
      const hash = await localStoreWrite(blob);
      await markForSync(hash, blob, name);
      return hash;
    },
    writeLinkedData: async (linkedData) => {
      const articleLdBlob = new Blob([JSON.stringify(linkedData)], {
        type: jsonLdMimeType,
      });
      const articleHash = await localStoreWrite(articleLdBlob);
      await markForSync(articleHash, articleLdBlob);

      await indexLinkedData({ hash: articleHash, ld: linkedData });

      return articleHash;
    },
    updateGdriveState: (gdrive: GDriveState) => {
      updateGdriveState(gdrive);
      updateState(
        mapState(gdrive, {
          idle: () => ["idle"],
          ready: () => ["idle"],
          loggingIn: () => ["idle"],
          profileRetrieving: () => ["idle"],
          logged: ({ config }) => {
            return ["downloading", config];
          },
          loggingOut: () => ["idle"],
        })
      );
    },
    storeStateProvider: (consumer) => {
      stateConsumer = consumer;
    },
  };
};
