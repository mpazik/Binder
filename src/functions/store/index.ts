import { Callback } from "../../libs/connections";
import { passUndefined } from "../../libs/connections/mappers";
import {
  computeLinkedDataWithHashId,
  hashBlob,
  HashName,
  HashUri,
} from "../../libs/hash";
import {
  storeDelete,
  storeGet,
  storeGetFirst,
  storeIterate,
  StoreName,
  storePut,
} from "../../libs/indexeddb";
import {
  jsonLdMimeType,
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/linked-data";
import { handleState, mapState } from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import { GDriveConfig } from "../gdrive/app-files";
import { GDriveState } from "../gdrive/controller";
import { findOrCreateFileByHash } from "../gdrive/file";
import { Indexer } from "../indexes/types";

import { createStatefulGDriveStoreRead } from "./gdrive-store-read";
import {
  getLinkedDataStore,
  getResourceStore,
  LinkedDataStoreRead,
  LinkedDataStoreWrite,
  ResourceStoreRead,
  ResourceStoreWrite,
} from "./local-store";
import { newMissingLinkedDataDownloader } from "./missing-linked-data-downloader";
import { registerRepositoryVersion, RepositoryDb } from "./repository";

export type {
  ResourceStoreWrite,
  LinkedDataStoreWrite,
  ResourceStoreRead,
} from "./local-store";

type Store = {
  readResource: ResourceStoreRead;
  writeResource: ResourceStoreWrite;
  readLinkedData: LinkedDataStoreRead;
  writeLinkedData: LinkedDataStoreWrite;
  updateGdriveState: (gdrive: GDriveState) => void;
};

export type BlobHashRecord = {
  name?: string;
  hash: HashUri;
};

const syncRequiredStoreName = "sync-required" as StoreName;
const syncPropsStoreName = "sync-props" as StoreName;

registerRepositoryVersion({
  version: 2,
  stores: [
    { name: syncRequiredStoreName, params: { autoIncrement: true } },
    { name: syncPropsStoreName },
  ],
});

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

const linkedDataToBlob = (ld: LinkedDataWithHashId): Blob =>
  new Blob([JSON.stringify(ld)], {
    type: jsonLdMimeType,
  });

export const createStore = (
  indexLinkedData: Indexer,
  repositoryDb: RepositoryDb,
  handleNewState: Callback<StoreState>
): Store => {
  const resourceStore = getResourceStore(repositoryDb);
  const putLocalResource = async (blob: Blob) => {
    const hash = await hashBlob(blob);
    await storePut(resourceStore, blob, hash);
    return hash;
  };

  const linkedDataStore = getLinkedDataStore(repositoryDb);
  const putLocalLinkedData = async (jsonld: LinkedData) => {
    const linkedDataToHash = await computeLinkedDataWithHashId(jsonld);
    await storePut(linkedDataStore, linkedDataToHash, linkedDataToHash["@id"]);
    return linkedDataToHash;
  };

  const syncRequiredStore = repositoryDb.getStoreProvider<BlobHashRecord>(
    syncRequiredStoreName
  );
  const syncPropsStore = repositoryDb.getStoreProvider<Date>(
    syncPropsStoreName
  );

  const [remoteStoreRead, updateGdriveState] = createStatefulGDriveStoreRead();
  let state: StoreState = ["idle"];

  const updateState = (newState: StoreState) => {
    state = newState;
    handleNewState(state);
    handleState(state, {
      downloading: async (config) => {
        const since = await storeGet<Date>(syncPropsStore, "last-sync");
        const downloader = newMissingLinkedDataDownloader(
          (handler) =>
            storeIterate(
              linkedDataStore,
              handler as (hash: IDBValidKey) => void
            ),
          putLocalLinkedData,
          indexLinkedData,
          config
        );
        downloader(since)
          .then(async (till) => {
            await storePut(syncPropsStore, till, "last-sync");
          })
          .then(() => updateState(["ready", config]));
      },
    });
  };

  const uploadNext = () => {
    // call outside as we don't want to catch here uploadNext errors
    setImmediate(() => uploadNextInt());
  };
  const uploadNextInt = async () => {
    const config: GDriveConfig | undefined =
      state[0] === "uploading" || state[0] === "ready" ? state[1] : undefined;
    if (config === undefined) return;

    const record = await storeGetFirst(syncRequiredStore);
    if (!record) {
      updateState(["ready", config]);
      return;
    }

    const {
      key,
      value: { hash, name },
    } = record;

    const blob: Blob | undefined =
      (await storeGet(resourceStore, hash)) ||
      passUndefined(linkedDataToBlob)(await storeGet(linkedDataStore, hash));

    if (!blob) {
      updateState([
        "error",
        {
          config,
          recordKey: key,
          error: {
            code: "sync-error-read",
            message: `Error reading file from local store for upload 
  File hash:${key}`,
          },
        },
      ]);
      return;
    }

    updateState(["uploading", config]);
    try {
      await findOrCreateFileByHash(config, hash, blob, name);
      // check: unbound promise
      await storeDelete(syncRequiredStore, key);
      uploadNext();
    } catch (e) {
      if (state[0] !== "uploading") {
        console.error("unexpected store state change");
      }
      updateState([
        "error",
        {
          config,
          recordKey: key,
          error: {
            code: "sync-error-upload",
            message: "Error saving file to google drive",
          },
        },
      ]);
    }
  };

  const markForSync = async (hash: HashUri, name?: string) => {
    // there should be account to which we want to sync it
    await storePut(syncRequiredStore, {
      hash,
      name,
    });
    if (state[0] !== "ready") return;
    uploadNext();
  };

  return {
    readResource: async (hash) => {
      return (
        (await storeGet(resourceStore, hash)) ??
        (await measureAsyncTime("read remote resource store", async () => {
          const result = await remoteStoreRead(hash);
          if (result) await putLocalResource(result);
          return result;
        }))
      );
    },
    writeResource: async (blob, name): Promise<HashName> => {
      const hash = await putLocalResource(blob);
      await markForSync(hash, name);
      return hash;
    },
    readLinkedData: async (hash) => storeGet(linkedDataStore, hash),
    writeLinkedData: async (linkedData) => {
      if (Array.isArray(linkedData)) {
        throw new Error("Array linked data are not supported");
      }

      const linkedDataWithHashId = await putLocalLinkedData(linkedData);
      await markForSync(linkedDataWithHashId["@id"]);
      await indexLinkedData(linkedDataWithHashId);
      return linkedDataWithHashId;
    },
    updateGdriveState: (gdrive: GDriveState) => {
      updateGdriveState(gdrive);
      updateState(
        mapState(gdrive, {
          idle: () => ["idle"],
          loading: () => ["idle"],
          ready: () => ["idle"],
          loggingIn: () => ["idle"],
          profileRetrieving: () => ["idle"],
          logged: ({ config }) => {
            return ["downloading", config];
          },
          loggingOut: () => ["idle"],
          error: () => ["idle"],
        })
      );
    },
  };
};
