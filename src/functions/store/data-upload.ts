import { asyncPool } from "../../libs/async-pool";
import { HashUri } from "../../libs/hash";
import {
  storeDelete,
  storeGet,
  storeGetAll,
  storeGetAllWithKeys,
  StoreProvider,
} from "../../libs/indexeddb";
import {
  jsonldFileExtension,
  jsonLdMimeType,
  LinkedData,
} from "../../libs/jsonld-format";
import { createZip } from "../../libs/zip";
import { GDriveConfig } from "../gdrive/app-files";
import {
  createFile,
  GDriveFileId,
  listFilesCreatedUntil,
  trashFile,
} from "../gdrive/file";

import { SyncRecord } from "./index";

const mimeToExtension = new Map([
  [jsonLdMimeType, jsonldFileExtension],
  ["text/html", "html"],
]);

const getFileName = (hash: string, mimeType: string, name?: string) => {
  const extension = mimeToExtension.get(mimeType);
  return (name ? name : hash) + (extension ? "." + extension : "");
};

const createResourceFile = async (
  { token, dirs }: GDriveConfig,
  blob: Blob,
  hash: HashUri,
  name?: string
): Promise<GDriveFileId> =>
  createFile(
    token,
    {
      name: getFileName(hash, blob.type, name),
      mimeType: blob.type,
      parents: [dirs.app],
      appProperties: { hashLink: hash, binder: "true" },
    },
    blob
  );

export const compressLinkedDataToZip = async (
  name: string,
  linkedDataList: LinkedData[]
): Promise<Blob> =>
  createZip([name + ".jsonld", JSON.stringify(linkedDataList)]);

const createZipFile = async (
  linkedDataList: LinkedData[],
  config: GDriveConfig,
  createdTime?: string
): Promise<void> => {
  const name = new Date().toISOString();
  const file = await compressLinkedDataToZip(name, linkedDataList);

  await createFile(
    config.token,
    {
      name: name + ".zip",
      mimeType: "zip",
      parents: [config.dirs.linkedData],
      appProperties: { binder: "true" },
      createdTime,
    },
    file
  );
};

// Uploads data needed to be synced and cleans the sync marker once it is successful
export const uploadDataToSync = async (
  resourceStore: StoreProvider<Blob>,
  linkedDataStore: StoreProvider<LinkedData>,
  syncRequiredStore: StoreProvider<SyncRecord>,
  config: GDriveConfig
): Promise<void> => {
  const records = await storeGetAllWithKeys<SyncRecord>(syncRequiredStore);

  // upload resources
  const resourceRecords = records.filter((it) => !it.value.ld);
  for (const {
    value: { hash, name },
    key,
  } of resourceRecords) {
    const blob = await storeGet(resourceStore, hash);
    if (blob) {
      await createResourceFile(config, blob, hash, name);
    } else {
      console.error(`Could not find resource with hash "${hash}" to sync`);
    }
    await storeDelete(syncRequiredStore, key);
  }

  // upload linked data
  const linkedDataRecords = records.filter((it) => it.value.ld);

  const linkedDataListWithGaps: (LinkedData | undefined)[] = await asyncPool(
    5,
    linkedDataRecords,
    async ({ value: { hash } }) => {
      const linkedData = await storeGet(linkedDataStore, hash);
      if (!linkedData) {
        console.error(`Could not find linked data with hash "${hash}" to sync`);
      }
      return linkedData;
    }
  );

  const linkedDataList = linkedDataListWithGaps.filter(
    (it) => it !== undefined
  ) as LinkedData[];

  await createZipFile(linkedDataList, config);
  await asyncPool(5, linkedDataRecords, async ({ key }) => {
    await storeDelete(syncRequiredStore, key);
  });
};

// Compress all the data stored locally as a single archive and uploads it
// then it would remove all old archives to the synchronisation point
export const mergeRemoteData = async (
  linkedDataStore: StoreProvider<LinkedData>,
  syncPropsStore: StoreProvider<Date>,
  config: GDriveConfig
): Promise<void> => {
  const lastSync = await storeGet<Date>(syncPropsStore, "last-sync");
  console.log("Merge modified since", lastSync);
  if (!lastSync) return;

  // this will be bottle neck at some point, we won't be able to load all of the data
  // later we could have to types of zip files, permanent and not
  // not permanent hashes would be once that come from zip bellow chunk size limit
  // then we would only compress non permanent zip files

  const allData = await storeGetAll(linkedDataStore);

  await createZipFile(allData, config, lastSync.toISOString());

  const fileModifiedUntilLastCheck = await listFilesCreatedUntil(
    config.dirs.linkedData,
    config.token,
    lastSync
  );

  await asyncPool(5, fileModifiedUntilLastCheck, async ({ fileId }) => {
    await trashFile(fileId, config.token);
  });
};
