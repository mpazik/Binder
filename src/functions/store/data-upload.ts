import * as JSZip from "jszip";

import { asyncPool } from "../../libs/async-pool";
import { HashUri } from "../../libs/hash";
import {
  storeDelete,
  storeGet,
  storeGetAllWithKeys,
  StoreProvider,
} from "../../libs/indexeddb";
import { jsonldFileExtension, LinkedData } from "../../libs/linked-data";
import { GDriveConfig } from "../gdrive/app-files";
import { createFile, GDriveFileId } from "../gdrive/file";

import { SyncRecord } from "./index";

const mimeToExtension = new Map([
  ["application/ld+json", jsonldFileExtension],
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

const compressToZip = async (
  name: string,
  linkedDataList: LinkedData[]
): Promise<Blob> => {
  const zip = new JSZip.default();
  zip.file(name + ".jsonld", JSON.stringify(linkedDataList));
  return await zip.generateAsync({ type: "blob" });
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

  const name = new Date().toISOString();
  const file = await compressToZip(name, linkedDataList);

  await createFile(
    config.token,
    {
      name: name + ".zip",
      mimeType: "zip",
      parents: [config.dirs.linkedData],
      appProperties: { binder: "true" },
    },
    file
  );

  await asyncPool(5, linkedDataRecords, async ({ key }) => {
    await storeDelete(syncRequiredStore, key);
  });
};
