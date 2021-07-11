import { filterUndefined } from "../../libs/array";
import { HashUri } from "../../libs/hash";
import { jsonldFileExtension, jsonLdMimeType } from "../../libs/jsonld-format";
import { createZip } from "../../libs/zip";
import { RemoteDrive } from "../remote-drive";

import { GDriveConfig } from "./app-files";
import {
  createFile,
  findFileIds,
  findFiles,
  GDriveFileId,
  getFileContent,
  trashFile,
} from "./file";

const mimeToExtension = new Map([
  [jsonLdMimeType, jsonldFileExtension],
  ["text/html", "html"],
]);

const getFileName = (hash: string, mimeType: string, name?: string) => {
  const extension = mimeToExtension.get(mimeType);
  return (name ? name : hash) + (extension ? "." + extension : "");
};

export const createGDrive = ({
  token,
  dirs,
}: GDriveConfig): RemoteDrive<GDriveFileId> => {
  return {
    downloadLinkedData: (fileId) => getFileContent(token, fileId),
    uploadLinkedData: async (linkedDataList, createdTime) => {
      const name = new Date().toISOString();
      return await createFile(
        token,
        {
          name: name + ".zip",
          mimeType: "zip",
          parents: [dirs.linkedData],
          appProperties: { binder: "true" },
          createdTime: createdTime?.toISOString(),
        },
        await createZip([name + ".jsonld", JSON.stringify(linkedDataList)])
      );
    },
    areResourcesUploaded: async (files) => {
      const hashQuery = files
        .map((hashUri) => `value='${hashUri}'`)
        .join(" or ");
      const query = encodeURI(
        [
          "trashed=false",
          `appProperties has { key='binder' and value='true' }`, // only created by binder
          `appProperties has { key='hashLink' and (${hashQuery}) }`, // only created by binder
          `'${dirs.app}' in parents`,
        ].join(" and ")
      );
      const remoteFiles = await findFiles(token, query);
      return new Set(filterUndefined(remoteFiles.map((it) => it.hashUri)));
    },
    downloadResourceFile: (fileId) => {
      return getFileContent(token, fileId);
    },
    uploadResourceFile: (blob: Blob, hash: HashUri, name?: string) => {
      return createFile(
        token,
        {
          name: getFileName(hash, blob.type, name),
          mimeType: blob.type,
          parents: [dirs.app],
          appProperties: { hashLink: hash, binder: "true" },
        },
        blob
      );
    },
    listLinkedDataCreatedSince: (createdSince) => {
      const query = encodeURI(
        [
          "trashed=false",
          `appProperties has { key='binder' and value='true' }`, // only created by binder
          `'${dirs.linkedData}' in parents`,
          ...(createdSince
            ? [`createdTime > '${createdSince.toISOString()}'`]
            : []), // if created since is not defined we return all files
        ].join(" and ")
      );
      return findFileIds(token, query);
    },
    listLinkedDataCreatedUntil: async (createdUntil) => {
      if (createdUntil === undefined) {
        return []; // if created until is not defined we return no files
      }
      const query = encodeURI(
        [
          "trashed=false",
          `appProperties has { key='binder' and value='true' }`, // only created by binder
          `'${dirs.linkedData}' in parents`,
          `createdTime < '${createdUntil.toISOString()}'`,
        ].join(" and ")
      );
      return findFileIds(token, query);
    },
    deleteFile: async (fileId) => {
      await trashFile(fileId, token);
    },
  };
};
