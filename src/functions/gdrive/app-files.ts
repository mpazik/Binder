import { GDRIVE_APP_DIR_NAME } from "../../config";
import { HashUri } from "../../libs/hash";
import {
  createStoreProvider,
  openDb,
  storeGet,
  StoreName,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";

import {
  GApi,
  GDriveQuota,
  GDriveUser,
  getUserProfile,
  GoogleAuthToken,
} from "./auth";
import {
  GDriveFileId,
  findOrCreateDir,
  findByHash,
  getFileContent,
} from "./file";

export type GoogleConfing = {
  authToken: GoogleAuthToken;
  localDb: GoogleDriveDb;
};

const dirFilesStore = "dir-files" as StoreName;

const getDirFilesStoreProvider = (
  localDb: GoogleDriveDb
): StoreProvider<GDriveFileId> => createStoreProvider(localDb, dirFilesStore);

const LINKED_DATA_DIR_NAME = "linked-data";

const getOrCreateDir = async (
  { authToken, localDb }: GoogleConfing,
  dirName: string,
  parent?: GDriveFileId
): Promise<GDriveFileId> => {
  const dirFilesStore = getDirFilesStoreProvider(localDb);
  const localFileId = await storeGet(dirFilesStore, dirName);
  if (localFileId) return localFileId;
  const fileId = await findOrCreateDir(authToken, dirName, parent);
  await storePut(dirFilesStore, fileId, dirName);
  return fileId;
};

export const getAppDir = (config: GoogleConfing): Promise<GDriveFileId> =>
  getOrCreateDir(config, GDRIVE_APP_DIR_NAME);

export const getLinkedDataDir = (
  config: GoogleConfing,
  appDir: GDriveFileId
): Promise<GDriveFileId> =>
  getOrCreateDir(config, LINKED_DATA_DIR_NAME, appDir);

export const getContent = async (
  { dirs, token }: GDriveConfig,
  hash: HashUri
): Promise<Blob> => {
  const file = await findByHash(token, [dirs.app, dirs.linkedData], hash);
  if (!file) {
    throw new Error(`Did not find a file for hash ${hash}`);
  }
  return getFileContent(token, file.fileId);
};

export type GoogleDriveDb = IDBDatabase;

export const openFileIdsDb = (): Promise<GoogleDriveDb> =>
  openDb(
    "google-drive-file-ids",
    (db) => {
      db.createObjectStore(dirFilesStore);
    },
    1
  );

export type GDriveConfig = {
  dirs: {
    app: GDriveFileId;
    linkedData: GDriveFileId;
  };
  token: GoogleAuthToken;
};

const createConfig = async (gapi: GApi): Promise<GDriveConfig> => {
  const token = gapi.auth.getToken().access_token as GoogleAuthToken;
  const localDb = await openFileIdsDb();
  const cfg = { authToken: token, localDb };
  const app = await getAppDir(cfg);
  const [linkedData] = await Promise.all([getLinkedDataDir(cfg, app)]);
  return {
    dirs: {
      app,
      linkedData,
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
