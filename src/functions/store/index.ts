import { Callback } from "../../libs/connections";
import {
  computeLinkedDataWithHashId,
  hashBlob,
  HashName,
  HashUri,
} from "../../libs/hash";
import {
  storeGet,
  storeGetFirst,
  StoreName,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { LinkedData, LinkedDataWithHashId } from "../../libs/linked-data";
import { handleState, mapState } from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import { GDriveConfig } from "../gdrive/app-files";
import { GDriveState } from "../gdrive/controller";
import { UpdateIndex } from "../indexes/types";

import { downloadNewData } from "./data-download";
import { mergeRemoteData, uploadDataToSync } from "./data-upload";
import { createStatefulGDriveStoreRead } from "./gdrive-store-read";
import {
  getLinkedDataStore,
  getResourceStore,
  LinkedDataStoreRead,
  LinkedDataStoreWrite,
  ResourceStoreRead,
  ResourceStoreWrite,
} from "./local-store";
import { registerRepositoryVersion, RepositoryDb } from "./repository";

export type {
  ResourceStoreWrite,
  LinkedDataStoreWrite,
  ResourceStoreRead,
} from "./local-store";

export type Store = {
  readResource: ResourceStoreRead;
  writeResource: ResourceStoreWrite;
  readLinkedData: LinkedDataStoreRead;
  writeLinkedData: LinkedDataStoreWrite;
  updateGdriveState: (gdrive: GDriveState) => void;
  switchRepo: (db: RepositoryDb) => void;
  upload: () => void;
  merge: () => void;
};

export type SyncRecord = {
  name?: string;
  hash: HashUri;
  ld: boolean;
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
  | ["merging", GDriveConfig]
  | ["downloading", GDriveConfig]
  | [
      "error",
      {
        config: GDriveConfig;
        error: { code: string; message: string };
      }
    ]
  | ["ready", GDriveConfig]
  | ["update-needed", GDriveConfig]
  | ["loaded", GDriveConfig];

export const createStore = (
  indexLinkedData: UpdateIndex,
  handleNewState: Callback<StoreState>
): Store => {
  // pass unclaimedDb
  let resourceStore: StoreProvider<Blob>;
  let linkedDataStore: StoreProvider<LinkedDataWithHashId>;
  let syncRequiredStore: StoreProvider<SyncRecord>;
  let syncPropsStore: StoreProvider<Date>;

  const putLocalResource = async (blob: Blob) => {
    const hash = await hashBlob(blob);
    await storePut(resourceStore, blob, hash);
    return hash;
  };

  const putLocalLinkedData = async (jsonld: LinkedData) => {
    const linkedDataToHash = await computeLinkedDataWithHashId(jsonld);
    await storePut(linkedDataStore, linkedDataToHash, linkedDataToHash["@id"]);
    return linkedDataToHash;
  };

  const [remoteStoreRead, updateGdriveState] = createStatefulGDriveStoreRead();
  let state: StoreState = ["idle"];

  const updateState = (newState: StoreState) => {
    state = newState;
    handleNewState(state);

    const handleError = (
      handlingState: StoreState[0],
      config: GDriveConfig,
      message: string,
      e: unknown
    ) => {
      if (state[0] !== handlingState) {
        console.error(`unexpected store state change from "${handlingState}"`);
      }
      console.error(message, e);
      updateState([
        "error",
        {
          config,
          error: {
            code: `sync-error-${handlingState}`,
            message: message,
          },
        },
      ]);
    };

    handleState(state, {
      downloading: async (config) => {
        try {
          await downloadNewData(
            linkedDataStore,
            syncPropsStore,
            indexLinkedData,
            config
          );
          updateState(["ready", config]);
        } catch (e) {
          handleError(
            "downloading",
            config,
            "rror downloading files from google drive",
            e
          );
        }
      },
      ready: async (config) => {
        // check if there is anything to upload
        const data = await storeGetFirst(syncRequiredStore);
        if (data !== undefined) {
          updateState(["update-needed", config]);
        }
      },
      uploading: async (config) => {
        try {
          await uploadDataToSync(
            resourceStore,
            linkedDataStore,
            syncRequiredStore,
            config
          );
          updateState(["ready", config]);
        } catch (e) {
          handleError(
            "uploading",
            config,
            "Error uploading files to google drive",
            e
          );
        }
      },
      merging: async (config) => {
        try {
          await downloadNewData(
            linkedDataStore,
            syncPropsStore,
            indexLinkedData,
            config
          );
          await mergeRemoteData(linkedDataStore, syncPropsStore, config);
          updateState(["ready", config]);
        } catch (e) {
          handleError(
            "merging",
            config,
            "Error merging files on google drive",
            e
          );
        }
      },
    });
  };

  const markForSync = async (
    hash: HashUri,
    linkedData: boolean,
    name?: string
  ) => {
    await storePut(syncRequiredStore, {
      hash,
      name,
      ld: linkedData,
    });
    if (state[0] !== "ready") return;
    updateState(["update-needed", state[1]]);
  };

  return {
    upload: () => {
      if (state[0] !== "update-needed") {
        console.error(
          "Can not upload data when store connection with the drive is not ready"
        );
        return;
      }
      updateState(["uploading", state[1]]);
    },
    merge: () => {
      if (state[0] !== "update-needed" && state[0] !== "ready") {
        console.error(
          "Can not upload data when store connection with the drive is not ready"
        );
        return;
      }
      updateState(["merging", state[1]]);
    },
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
      await markForSync(hash, false, name);
      return hash;
    },
    readLinkedData: async (hash) => storeGet(linkedDataStore, hash),
    writeLinkedData: async (linkedData) => {
      if (Array.isArray(linkedData)) {
        throw new Error("Array linked data are not supported");
      }

      const linkedDataWithHashId = await putLocalLinkedData(linkedData);
      await markForSync(linkedDataWithHashId["@id"], true);
      await indexLinkedData(linkedDataWithHashId);
      return linkedDataWithHashId;
    },
    updateGdriveState: (gdrive: GDriveState) => {
      updateGdriveState(gdrive);
      updateState(
        mapState(gdrive, {
          idle: () => ["idle"],
          loading: () => ["idle"],
          signedOut: () => ["idle"],
          disconnected: () => ["idle"],
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
    switchRepo: (repositoryDb) => {
      resourceStore = getResourceStore(repositoryDb);
      linkedDataStore = getLinkedDataStore(repositoryDb);
      syncRequiredStore = repositoryDb.getStoreProvider<SyncRecord>(
        syncRequiredStoreName
      );
      syncPropsStore = repositoryDb.getStoreProvider<Date>(syncPropsStoreName);
    },
  };
};
