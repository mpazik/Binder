import { GDRIVE_APP_DIR_NAME } from "../../config";
import { HashUri } from "../../libs/hash";
import {
  openDb,
  storeGet,
  StoreName,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { registerRepositoryVersion, RepositoryDb } from "../store/repository";

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
  repositoryDb: RepositoryDb;
};

const dirFilesStoreName = "dir-files" as StoreName;

const getDirFilesStoreProvider = (
  repositoryDb: RepositoryDb
): StoreProvider<GDriveFileId> =>
  repositoryDb.getStoreProvider(dirFilesStoreName);

registerRepositoryVersion({
  version: 6,
  stores: [{ name: dirFilesStoreName }],
});

const LINKED_DATA_DIR_NAME = "linked-data";

const getOrCreateDir = async (
  { authToken, repositoryDb }: GoogleConfing,
  dirName: string,
  parent?: GDriveFileId
): Promise<GDriveFileId> => {
  const dirFilesStore = getDirFilesStoreProvider(repositoryDb);
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
      db.createObjectStore(dirFilesStoreName);
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

export const createGDriveConfig = async (
  gapi: GApi,
  repositoryDb: RepositoryDb
): Promise<GDriveConfig> => {
  const token = gapi.auth.getToken().access_token as GoogleAuthToken;
  const cfg = { authToken: token, repositoryDb };
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

export type GDriveLoadingProfile = {
  repository: RepositoryDb;
  user: GDriveUser | undefined;
};

export type GDriveLoggedOurProfile = {
  repository: RepositoryDb;
  gapi: GApi;
};

// we use the last user account but there is no access to the internet right now
export type GDriveDisconnectedProfile = GDriveLoggedOurProfile & {
  user: GDriveUser;
};

export type GDriveProfile = GDriveDisconnectedProfile & {
  config: GDriveConfig;
  storageQuota: GDriveQuota;
};

export const createProfile = async (
  gapi: GApi,
  repository: RepositoryDb
): Promise<GDriveProfile> => {
  const profile = await getUserProfile(gapi);
  return {
    gapi,
    config: await createGDriveConfig(gapi, repository),
    repository,
    ...profile,
  };
};
