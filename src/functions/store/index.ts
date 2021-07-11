import { Callback } from "../../libs/connections";
import {
  computeLinkedDataWithHashId,
  hashBlob,
  HashName,
  HashUri,
} from "../../libs/hash";
import {
  storeDelete,
  storeGet,
  storeGetAll,
  storeGetAllWithKeys,
  storeGetFirst,
  StoreName,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { LinkedData, LinkedDataWithHashId } from "../../libs/jsonld-format";
import { handleState, mapState } from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import { createGDrive } from "../gdrive";
import { GDriveConfig } from "../gdrive/app-files";
import { GDriveState } from "../gdrive/controller";
import { GDriveFileId } from "../gdrive/file";
import { UpdateIndex } from "../indexes/types";

import { createDataDownloader } from "./data-download";
import {
  createDataUploader,
  createLinkedDataUploader,
  createResourceUploader,
} from "./data-upload";
import { newExecutionTimeSaver } from "./execution-time-saver";
import { createStatefulGDriveStoreRead } from "./gdrive-store-read";
import { extractLinkedDataFromResponse } from "./link-data-response-extractor";
import {
  ExternalLinkedDataStoreWrite,
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

interface StoreSync {
  uploadData: () => Promise<void>;
  downloadData: () => Promise<void>;
}

export type StoreState =
  | ["idle"]
  | ["uploading", StoreSync]
  | ["downloading", StoreSync]
  | [
      "error",
      {
        setup: StoreSync;
        error: { code: string; message: string };
      }
    ]
  | ["ready", StoreSync]
  | ["update-needed", StoreSync]
  | ["loaded", StoreSync];

export const createStore = (
  indexLinkedData: UpdateIndex,
  handleNewState: Callback<StoreState>
): Store => {
  // pass unclaimedDb
  let resourceStore: StoreProvider<Blob>;
  let linkedDataStore: StoreProvider<LinkedDataWithHashId>;
  let syncRequiredStore: StoreProvider<SyncRecord>;
  let syncPropsStore: StoreProvider<Date>;
  const getLastSyncTime = () => storeGet<Date>(syncPropsStore, "last-sync");
  const downloadSyncTimeSaver = newExecutionTimeSaver(
    () => new Date(),
    getLastSyncTime,
    (date) => storePut<Date>(syncPropsStore, date, "last-sync").then(() => {})
  );

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

  const saveExternalLinkedData: ExternalLinkedDataStoreWrite = async (
    data: LinkedDataWithHashId
  ) => {
    const hash = data["@id"];
    // check for duplicates
    const existing = await storeGet(linkedDataStore, hash);
    if (existing !== undefined) return;
    await storePut(linkedDataStore, data, hash);
    await indexLinkedData(data);
  };

  const [remoteStoreRead, updateGdriveState] = createStatefulGDriveStoreRead();
  let state: StoreState = ["idle"];

  const setupStoreSync = (config: GDriveConfig): StoreSync => {
    const remoteDrive = createGDrive(config);
    return {
      downloadData: () =>
        downloadSyncTimeSaver(
          createDataDownloader<GDriveFileId>(
            remoteDrive.listLinkedDataCreatedSince,
            remoteDrive.downloadLinkedData,
            saveExternalLinkedData,
            extractLinkedDataFromResponse
          )
        ),
      uploadData: createDataUploader<IDBValidKey>(
        createResourceUploader(
          (hash) => storeGet(resourceStore, hash),
          remoteDrive.uploadResourceFile,
          remoteDrive.areResourcesUploaded
        ),
        createLinkedDataUploader(
          (hash) => storeGet(linkedDataStore, hash),
          () => storeGetAll(linkedDataStore),
          remoteDrive.uploadLinkedData,
          remoteDrive.listLinkedDataCreatedUntil,
          remoteDrive.deleteFile,
          getLastSyncTime
        ),
        () =>
          storeGetAllWithKeys<SyncRecord>(syncRequiredStore).then((it) =>
            it.map((item) => [item.key, item.value])
          ),
        (key) => storeDelete(syncRequiredStore, key)
      ),
    };
  };

  const updateState = (newState: StoreState) => {
    state = newState;
    handleNewState(state);

    const handleError = (
      handlingState: StoreState[0],
      setup: StoreSync,
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
          setup,
          error: {
            code: `sync-error-${handlingState}`,
            message: message,
          },
        },
      ]);
    };

    handleState(state, {
      downloading: async (storeSync) => {
        try {
          await downloadSyncTimeSaver(storeSync.downloadData);
          updateState(["ready", storeSync]);
        } catch (e) {
          handleError(
            "downloading",
            storeSync,
            "Error downloading files from google drive",
            e
          );
        }
      },
      ready: async (storeSync) => {
        // check if there is anything to upload
        const data = await storeGetFirst(syncRequiredStore);
        if (data !== undefined) {
          updateState(["update-needed", storeSync]);
        }
      },
      uploading: async (storeSync) => {
        try {
          await storeSync.uploadData();
          updateState(["ready", storeSync]);
        } catch (e) {
          handleError(
            "uploading",
            storeSync,
            "Error uploading files to google drive",
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
            return ["downloading", setupStoreSync(config)];
          },
          loggingOut: () => ["idle"],
          error: () => ["idle"],
        })
      );
    },
    switchRepo: (repositoryDb) => {
      // if repo is unclaimed
      // if it is flag
      // if flag is true go trough each
      // const oldResourceStore = resourceStore
      // const oldLinkedDataStore = linkedDataStore
      // const oldSyncRequiredStore = syncRequiredStore
      resourceStore = getResourceStore(repositoryDb);
      linkedDataStore = getLinkedDataStore(repositoryDb);
      syncRequiredStore = repositoryDb.getStoreProvider<SyncRecord>(
        syncRequiredStoreName
      );
      syncPropsStore = repositoryDb.getStoreProvider<Date>(syncPropsStoreName);
    },
  };
};
