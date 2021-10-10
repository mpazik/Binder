import type { HashUri } from "../../libs/hash";
import type { Opaque } from "../../libs/types";

import type { GoogleAuthToken } from "./auth";

export type GDriveFileId = Opaque<string>;
export type GDriveFile = {
  fileId: GDriveFileId;
  hashUri?: HashUri;
};
export type Metadata = {
  name: string;
  mimeType: string;
  parents?: GDriveFileId[];
  createdTime?: string;
  appProperties?: { [key: string]: string };
};

export const createFile = async (
  authToken: GoogleAuthToken,
  metadata: Metadata,
  file?: Blob
): Promise<GDriveFileId> => {
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  if (file) {
    form.append("file", file);
  }

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: new Headers({ Authorization: "Bearer " + authToken }),
      body: form,
    }
  );
  const data = await res.json();
  return data.id;
};

const DIR_MIME_TYPE = `application/vnd.google-apps.folder`;

export const createDir = (
  authToken: GoogleAuthToken,
  name: string,
  parent?: GDriveFileId
): Promise<GDriveFileId> =>
  createFile(authToken, {
    name,
    mimeType: DIR_MIME_TYPE,
    ...(parent ? { parents: [parent] } : {}),
  });

export const getFileContent = (
  authToken: string,
  fileId: GDriveFileId
): Promise<Response> =>
  fetch(`https://www.googleapis.com/drive/v2/files/${fileId}?alt=media`, {
    method: "GET",
    headers: new Headers({ Authorization: "Bearer " + authToken }),
  });

export const getFileMetadata = (
  authToken: string,
  fileId: GDriveFileId
): Promise<Blob> =>
  fetch(`https://www.googleapis.com/drive/v2/files/${fileId}`, {
    method: "GET",
    headers: new Headers({ Authorization: "Bearer " + authToken }),
  }).then((it) => it.json());

export const findFiles = async (
  authToken: GoogleAuthToken,
  query: string
): Promise<GDriveFile[]> => {
  const fields = encodeURI(`files(id, appProperties, name)`);
  const data = (await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}`,
    {
      method: "GET",
      headers: new Headers({ Authorization: "Bearer " + authToken }),
    }
  ).then((it) => it.json())) as {
    files: {
      id: GDriveFileId;
      appProperties?: { hashLink?: HashUri };
      name: string;
    }[];
  };
  return data.files.map((it) => ({
    fileId: it.id,
    hashUri: it.appProperties?.hashLink,
    name: it.name,
  }));
};

export const findFileIds = async (
  authToken: GoogleAuthToken,
  query: string
): Promise<GDriveFileId[]> => {
  const fields = encodeURI(`files(id)`);
  const data = (await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000`,
    {
      method: "GET",
      headers: new Headers({ Authorization: "Bearer " + authToken }),
    }
  ).then((it) => it.json())) as {
    nextPageToken: string;
    files: { id: GDriveFileId }[];
  };
  // todo handle next page token { next: async () = >}
  if (data.nextPageToken) {
    console.error(
      "There is more result on google drive that were not downloaded"
    );
  }
  return data.files.map((it) => it.id);
};

export const findDir = (
  authToken: GoogleAuthToken,
  name: string,
  parent?: GDriveFileId
): Promise<GDriveFileId[]> => {
  const query = encodeURI(
    [
      `name='${name}'`,
      "trashed=false",
      `mimeType='${DIR_MIME_TYPE}'`,
      ...(parent ? [`'${parent}' in parents`] : []),
    ].join(" and ")
  );
  return findFileIds(authToken, query);
};

export const findOrCreateDir = async (
  authToken: GoogleAuthToken,
  name: string,
  parent?: GDriveFileId
): Promise<GDriveFileId> => {
  const dirs = await findDir(authToken, name, parent);
  if (dirs.length > 0) {
    return dirs[0];
  }
  return createDir(authToken, name, parent);
};

export const findByName = async (
  authToken: GoogleAuthToken,
  name: string,
  parent?: GDriveFileId
): Promise<GDriveFile[]> => {
  const query = encodeURI(
    [
      "trashed=false",
      `name='${name}'`,
      ...(parent ? [`'${parent}' in parents`] : []),
    ].join(" and ")
  );
  return findFiles(authToken, query);
};

export const findByHash = async (
  authToken: GoogleAuthToken,
  dirs: GDriveFileId[],
  hash: HashUri
): Promise<GDriveFile | undefined> => {
  const query = encodeURI(
    [
      "trashed=false",
      `appProperties has { key='hashLink' and value='${hash}' }`,
      `(${dirs.map((dir) => `'${dir}' in parents`).join(" or ")})`,
    ].join(" and ")
  );
  const files = await findFiles(authToken, query);
  if (files.length > 1) {
    console.error(
      `Expected to have a single file for hash ${hash} but found ${JSON.stringify(
        files
      )}`
    );
    return files[0];
  }
  if (files.length > 0) {
    return files[0];
  }
};

export const updateFile = async (
  fileId: GDriveFileId,
  authToken: GoogleAuthToken,
  blob: Blob
): Promise<Response> =>
  await fetch(`https://www.googleapis.com/upload/drive/v2/files/${fileId}`, {
    method: "PUT",
    headers: new Headers({ Authorization: "Bearer " + authToken }),
    body: blob,
  });

export const deleteFile = async (
  fileId: GDriveFileId,
  authToken: GoogleAuthToken
): Promise<Response> =>
  await fetch(`https://www.googleapis.com/drive/v2/files/${fileId}`, {
    method: "DELETE",
    headers: new Headers({ Authorization: "Bearer " + authToken }),
  });

export const trashFile = async (
  fileId: GDriveFileId,
  authToken: GoogleAuthToken
): Promise<Response> =>
  await fetch(`https://www.googleapis.com/drive/v2/files/${fileId}/trash`, {
    method: "POST",
    headers: new Headers({ Authorization: "Bearer " + authToken }),
  });
