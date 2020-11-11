import { GDRIVE_APP_DIR_NAME } from "../../config";
import { openDb, storeGet, StoreName, storePut } from "../../utils/indexeddb";

import {
  GApi,
  GDriveQuota,
  GDriveUser,
  getUserProfile,
  GoogleAuthToken,
} from "./auth";
import { GDriveFileId, findOrCreateDir, findOrCreateFile } from "./file";

export type GoogleConfing = {
  authToken: GoogleAuthToken;
  localDb: GoogleDriveDb;
};

const indexFilesStore = "index-files" as StoreName;
const dirFilesStore = "dir-files" as StoreName;

const LINKED_DATA_DIR_NAME = "linked-data";
const INDEX_DIR_NAME = "index";

const getOrCreateDir = async (
  { authToken, localDb }: GoogleConfing,
  dirName: string,
  parent?: GDriveFileId
): Promise<GDriveFileId> => {
  const localFileId = await storeGet<GDriveFileId>(
    localDb,
    dirName,
    dirFilesStore
  );
  if (localFileId) return localFileId;
  const fileId = await findOrCreateDir(authToken, dirName, parent);
  await storePut(localDb, fileId, dirName, dirFilesStore);
  return fileId;
};

export const getAppDir = (config: GoogleConfing) =>
  getOrCreateDir(config, GDRIVE_APP_DIR_NAME);

export const getLinkedDataDir = (config: GoogleConfing, appDir: GDriveFileId) =>
  getOrCreateDir(config, LINKED_DATA_DIR_NAME, appDir);

export const getIndexDir = (config: GoogleConfing, appDir: GDriveFileId) =>
  getOrCreateDir(config, INDEX_DIR_NAME, appDir);

export const getIndexFile = async (
  { authToken, localDb }: GoogleConfing,
  indexName: string,
  indexDir: GDriveFileId
): Promise<GDriveFileId> => {
  const localFileId = await storeGet<GDriveFileId>(
    localDb,
    indexName,
    indexFilesStore
  );
  if (localFileId) return localFileId;
  const file = await findOrCreateFile(
    authToken,
    indexName + ".jsonld",
    "application/json",
    indexDir
  );
  await storePut(localDb, file, indexName, indexFilesStore);
  return file.fileId;
};

export type GoogleDriveDb = IDBDatabase;

export const openFileIdsDb = (): Promise<GoogleDriveDb> =>
  openDb(
    "google-drive-file-ids",
    (event) => {
      const db = (event.target as IDBRequest<IDBDatabase>)!.result;
      db.createObjectStore(indexFilesStore);
      db.createObjectStore(dirFilesStore);
    },
    1
  );

export type GDriveConfig = {
  dirs: {
    app: GDriveFileId;
    linkedData: GDriveFileId;
    index: GDriveFileId;
  };
  token: GoogleAuthToken;
};

const createConfig = async (gapi: GApi): Promise<GDriveConfig> => {
  const token = gapi.auth.getToken().access_token as GoogleAuthToken;
  const localDb = await openFileIdsDb();
  const cfg = { authToken: token, localDb };
  const app = await getAppDir(cfg);
  const [index, linkedData] = await Promise.all([
    getIndexDir(cfg, app),
    getLinkedDataDir(cfg, app),
  ]);
  return {
    dirs: {
      app,
      linkedData,
      index,
    },
    token,
  };
};

export type GDriveProfile = {
  config: GDriveConfig;
  gapi: GApi;
  user: GDriveUser;
  storageQuota: GDriveQuota;
};

export const createProfile = async (gapi: GApi): Promise<GDriveProfile> => {
  const profile = await getUserProfile(gapi);
  return {
    gapi,
    config: await createConfig(gapi),
    ...profile,
  };
};
