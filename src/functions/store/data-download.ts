import * as JSZip from "jszip";

import { asyncPool } from "../../libs/async-pool";
import { storeGet, StoreProvider, storePut } from "../../libs/indexeddb";
import { LinkedData, LinkedDataWithHashId } from "../../libs/linked-data";
import { GDriveConfig } from "../gdrive/app-files";
import { getFileContent, listFilesCreatedSince } from "../gdrive/file";
import { UpdateIndex } from "../indexes/types";

type LinkedDataFile = LinkedDataWithHashId | LinkedDataWithHashId[];

export const downloadNewData = async (
  linkedDataStore: StoreProvider<LinkedData>,
  syncPropsStore: StoreProvider<Date>,
  index: UpdateIndex,
  config: GDriveConfig
): Promise<void> => {
  const currentSync = new Date();
  const lastSync = await storeGet<Date>(syncPropsStore, "last-sync");
  const fileModifiedSinceLastCheck = await listFilesCreatedSince(
    config.dirs.linkedData,
    config.token,
    lastSync
  );

  const saveLinkedData = async (data: LinkedDataWithHashId) => {
    const hash = data["@id"];
    const existing = await storeGet(linkedDataStore, hash);
    if (existing !== undefined) return;
    await storePut(linkedDataStore, data, hash);
    await index(data);
  };

  const saveLinkedDataFile = async (data: LinkedDataFile) => {
    if (Array.isArray(data)) {
      for (const item of data) {
        await saveLinkedData(item);
      }
    } else {
      await saveLinkedData(data);
    }
  };

  await asyncPool(3, fileModifiedSinceLastCheck, async (file) => {
    const response = await getFileContent(config.token, file.fileId);

    if (response.headers.get("content-type") === "application/ld+json") {
      const content = await response.json();
      await saveLinkedDataFile(content);
    } else if (response.headers.get("content-type") === "application/zip") {
      const blob = await response.blob();
      const zip = await JSZip.loadAsync(blob);
      for (const file of Object.values(zip.file(/.*\.jsonld/))) {
        const content = JSON.parse(
          await file.async("string")
        ) as LinkedDataFile;
        await saveLinkedDataFile(content);
      }
    }
  });
  await storePut(syncPropsStore, currentSync, "last-sync");
};
