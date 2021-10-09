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
  storeOneWayIterate,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { LinkedData, LinkedDataWithHashId } from "../../libs/jsonld-format";
import { getType } from "../../libs/linked-data";
import { handleState, mapState } from "../../libs/named-state";
import {
  onBrowserClose,
  RegisterBrowserClose,
} from "../../libs/on-browser-close";
import { measureAsyncTime } from "../../libs/performance";
import { browserTimer, SetupTimer, setupTimer } from "../../libs/timer";
import { AnalyticsSender, createErrorSender } from "../analytics";
import { UpdateIndex } from "../indexes/types";
import { RemoteDrive, RemoteDriverState } from "../remote-drive";

import { createDataDownloader } from "./data-download";
import {
  createDataUploader,
  createLinkedDataUploader,
  createResourceUploader,
} from "./data-upload";
import { newExecutionTimeSaver } from "./execution-time-saver";
import { extractLinkedDataFromResponse } from "./link-data-response-extractor";
import {
  ExternalLinkedDataStoreWrite,
  getResourceStore,
  LinkedDataStoreRead,
  LinkedDataStoreWrite,
  ResourceStoreRead,
  ResourceStoreWrite,
  LinkedDataDelete,
  createDynamicLinkedDataStore,
  createLinkedDataDelete,
} from "./local-store";
import { createStatefulRemoteDriveResourceRead } from "./remote-drive-store-read";
import {
  registerRepositoryVersion,
  RepositoryDb,
  UnclaimedRepositoryDb,
} from "./repository";

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
  removeLinkedData: LinkedDataDelete;
  updateRemoteDriveState: (driveState: RemoteDriverState) => void;
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

const autoUpdateTimeout = 5 * 60 * 1000;

const linkedDataTypeThatCouldBeRemoved = ["WatchAction", "ReplaceAction"];

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
  | ["uploadNeeded", StoreSync & { stopAutoUpdate: () => void }]
  | ["loaded", StoreSync];

export const createStore = (
  indexLinkedData: UpdateIndex,
  handleNewState: Callback<StoreState>,
  unclaimedRepo: UnclaimedRepositoryDb,
  sendAnalytics: AnalyticsSender,
  autoUpdateTimer: SetupTimer = setupTimer(browserTimer, autoUpdateTimeout),
  registerBeforeClose: RegisterBrowserClose = onBrowserClose
): Store => {
  // this should be part of a state
  let unclaimedRepoCurrent = false;
  let resourceStore: StoreProvider<Blob>;
  let syncRequiredStore: StoreProvider<SyncRecord>;
  let syncPropsStore: StoreProvider<Date>;
  const [
    linkedDataStore,
    switchRepoForLinkedData,
  ] = createDynamicLinkedDataStore();
  const removeLinkedData = createLinkedDataDelete(linkedDataStore);

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
  const sendError = createErrorSender(sendAnalytics);

  const canBeDeleted = async (hash: HashUri): Promise<boolean> => {
    const data = await storeGet(linkedDataStore, hash);
    if (!data) return false;
    const type = getType(data);
    if (!type) return false;
    return linkedDataTypeThatCouldBeRemoved.includes(type);
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

  const [
    remoteStoreRead,
    updateDriveReaderState,
  ] = createStatefulRemoteDriveResourceRead();
  let state: StoreState = ["idle"];

  registerBeforeClose(() => {
    if (state[0] !== "uploadNeeded") {
      return;
    }
    state[1].stopAutoUpdate();
    updateState(["uploading", state[1]]);
    return "Your browser data is uploading to remove drive, please don't leave now";
  });

  const setupStoreSync = (drive: RemoteDrive): StoreSync => {
    return {
      downloadData: () =>
        downloadSyncTimeSaver(
          createDataDownloader(
            drive.listLinkedDataCreatedSince,
            drive.downloadLinkedData,
            saveExternalLinkedData,
            extractLinkedDataFromResponse
          )
        ),
      uploadData: createDataUploader<IDBValidKey>(
        createResourceUploader(
          (hash) => storeGet(resourceStore, hash),
          drive.uploadResourceFile,
          drive.areResourcesUploaded
        ),
        createLinkedDataUploader(
          (hash) => storeGet(linkedDataStore, hash),
          () => storeGetAll(linkedDataStore),
          drive.uploadLinkedData,
          drive.listLinkedDataCreatedUntil,
          drive.deleteFile,
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

  const changeToUpdateNeeded = (storeSync: StoreSync) => {
    const stopAutoUpdate = autoUpdateTimer(() => {
      updateState(["uploading", storeSync]);
    });
    updateState(["uploadNeeded", { ...storeSync, stopAutoUpdate }]);
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
        sendError({
          key: "unexpected-store-change",
          from: handlingState,
        });
        console.error(`unexpected store state change from "${handlingState}"`);
      }
      sendError({
        key: "sync-error",
        state: handlingState,
        message,
      });
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
          updateState(["uploading", storeSync]);
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
    await storePut(
      syncRequiredStore,
      {
        hash,
        name,
        ld: linkedData,
      },
      hash
    );
    if (state[0] !== "ready") return;
    changeToUpdateNeeded(state[1]);
  };

  const unmarkLinkedDataForSync = async (hash: HashUri) => {
    await storeDelete(syncRequiredStore, hash);
  };

  return {
    upload: () => {
      if (state[0] !== "uploadNeeded") {
        console.error(
          "Can not upload data when store connection with the drive is not ready"
        );
        return;
      }
      state[1].stopAutoUpdate();
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
      sendAnalytics("save-resource", { type: blob.type });
      return hash;
    },
    removeLinkedData: async (hash) => {
      if (!(await canBeDeleted(hash))) {
        const data = await storeGet(linkedDataStore, hash);
        console.error("Ignored illegal delete operation on item", data);
        return;
      }
      await unmarkLinkedDataForSync(hash);
      await removeLinkedData(hash);
    },
    readLinkedData: async (hash) => storeGet(linkedDataStore, hash),
    writeLinkedData: async (linkedData) => {
      if (Array.isArray(linkedData)) {
        throw new Error("Array linked data are not supported");
      }

      const linkedDataWithHashId = await putLocalLinkedData(linkedData);
      await markForSync(linkedDataWithHashId["@id"], true);
      await indexLinkedData(linkedDataWithHashId);
      sendAnalytics("save-linked-data", { type: getType(linkedData) });
      return linkedDataWithHashId;
    },
    updateRemoteDriveState: (driveState: RemoteDriverState) => {
      updateDriveReaderState(driveState);
      updateState(
        mapState(driveState, {
          off: () => ["idle"],
          loading: () => ["idle"],
          on: (drive) => {
            return ["downloading", setupStoreSync(drive)];
          },
        })
      );
    },
    switchRepo: (repositoryDb) => {
      // this is really ugly implementation
      const setRepo = () => {
        resourceStore = getResourceStore(repositoryDb);
        switchRepoForLinkedData(repositoryDb);
        syncRequiredStore = repositoryDb.getStoreProvider<SyncRecord>(
          syncRequiredStoreName
        );
        syncPropsStore = repositoryDb.getStoreProvider<Date>(
          syncPropsStoreName
        );
      };

      if (repositoryDb === unclaimedRepo) {
        unclaimedRepoCurrent = true;
      } else if (unclaimedRepoCurrent) {
        measureAsyncTime("claiming logged off data", async () => {
          const oldResourceStore = resourceStore;
          const oldLinkedDataStore = linkedDataStore;
          const oldSyncRequiredStore = syncRequiredStore;
          setRepo();

          await storeOneWayIterate(oldResourceStore, putLocalResource);
          await storeOneWayIterate(oldLinkedDataStore, async (ld) => {
            const linkedDataWithHashId = await putLocalLinkedData(ld);
            await indexLinkedData(linkedDataWithHashId);
          });
          await storeOneWayIterate(oldSyncRequiredStore, (sd) =>
            storePut(syncRequiredStore, sd)
          );
        });
        return;
      }
      setRepo();
    },
  };
};
