import { splitArray } from "../../libs/array";
import { asyncPool, browserHostConnectionsLimit } from "../../libs/async-pool";
import { HashUri } from "../../libs/hash";
import { LinkedDataWithHashId } from "../../libs/jsonld-format";
import { RemoteDrive } from "../remote-drive";

import { LinkedDataStoreRead, LinkedDataStoreReadAll } from "./local-store";

import { ResourceStoreRead, SyncRecord } from "./index";

export type DataUpload = () => Promise<void>;

type LinkedDataUploader = (linkedDataHashes: HashUri[]) => Promise<void>;

// We limit how many archives are on remote drive so in worst case we could fetch one in a single round of calls
const limitOfLinkedDtaFilesOnDrive = browserHostConnectionsLimit;

export const createLinkedDataUploader = <FileId>(
  readLinkedData: LinkedDataStoreRead,
  readAllLinkedData: LinkedDataStoreReadAll,
  uploadLinkedData: RemoteDrive<FileId>["uploadLinkedData"],
  listLinkedDataCreatedUntil: RemoteDrive<FileId>["listLinkedDataCreatedUntil"],
  deleteFile: RemoteDrive<FileId>["deleteFile"],
  getLastSyncDate: () => Promise<Date | undefined>
): LinkedDataUploader => {
  let linkedDataFilesOnDrive: number | undefined;

  return async (linkedDataHashes) => {
    if (linkedDataFilesOnDrive === undefined) {
      const lastSync = await getLastSyncDate();
      // potential problem if user will add files that we can not remove
      linkedDataFilesOnDrive = (await listLinkedDataCreatedUntil(lastSync))
        .length;
    }
    if (linkedDataFilesOnDrive < limitOfLinkedDtaFilesOnDrive) {
      const linkedDataList: LinkedDataWithHashId[] = [];
      for (const hash of linkedDataHashes) {
        const linkedData = await readLinkedData(hash);
        if (!linkedData) {
          console.error(
            `Could not find linked data with hash "${hash}" to sync`
          );
        } else {
          linkedDataList.push(linkedData);
        }
      }

      await uploadLinkedData(linkedDataList);
      linkedDataFilesOnDrive += 1;
    } else {
      const lastSync = await getLastSyncDate();

      // this will be bottle neck at some point, we won't be able to load all of the data
      // later we could have to types of zip files, permanent and not
      // not permanent hashes would be once that come from zip bellow chunk size limit
      // then we would only compress non permanent zip files
      const allData = await readAllLinkedData();

      // if something will go wrong here the old files will still be on the remote drive
      // passing last sync as creation time, so we would not re-download the data
      await uploadLinkedData(allData, lastSync);
      linkedDataFilesOnDrive += 1;

      // cleanup all files that are not needed
      const fileModifiedUntilLastCheck = await listLinkedDataCreatedUntil(
        lastSync
      );
      await asyncPool(fileModifiedUntilLastCheck, deleteFile);
      linkedDataFilesOnDrive = 1;
    }
  };
};

type ResourceUploader = (
  resourceRecords: { hash: HashUri; name?: string }[]
) => Promise<void>;

export const createResourceUploader = <FileId>(
  readResource: ResourceStoreRead,
  uploadResourceFile: RemoteDrive<FileId>["uploadResourceFile"],
  areResourcesUploaded: RemoteDrive<FileId>["areResourcesUploaded"]
): ResourceUploader => async (resourceRecords) => {
  const uploadedFiles = await areResourcesUploaded(
    resourceRecords.map(({ hash }) => hash)
  );
  await asyncPool(resourceRecords, async ({ hash, name }) => {
    // do not re-upload files that are already on the remote drive
    if (uploadedFiles.has(hash)) {
      return;
    }
    const blob = await readResource(hash);
    if (blob) {
      await uploadResourceFile(blob, hash, name);
    } else {
      console.error(
        `Could not find resource with hash "${hash}" for an upload to the remote drive`
      );
    }
  });
};

export const createDataUploader = <SyncKey>(
  uploadResources: ResourceUploader,
  uploadLinkedData: LinkedDataUploader,
  getFilesToSync: () => Promise<[SyncKey, SyncRecord][]>,
  markFileAsSync: (key: SyncKey) => Promise<void>
): DataUpload => {
  return async () => {
    try {
      const records = await getFilesToSync();

      // upload resources
      const [linkedDataRecords, resourceRecords] = splitArray(
        records,
        (it) => it[1].ld
      );

      await uploadResources(resourceRecords.map((it) => it[1]));
      for (const it of resourceRecords) {
        await markFileAsSync(it[0]);
      }

      await uploadLinkedData(linkedDataRecords.map((it) => it[1].hash));
      for (const it of linkedDataRecords) {
        await markFileAsSync(it[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };
};
