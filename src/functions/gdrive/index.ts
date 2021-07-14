import { filterUndefined } from "../../libs/array";
import { HashUri } from "../../libs/hash";
import { jsonldFileExtension, jsonLdMimeType } from "../../libs/jsonld-format";
import { createZip } from "../../libs/zip";
import { RemoteDrive } from "../remote-drive";

import { GDriveConfig } from "./app-files";
import {
  createFile,
  findByHash,
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
          createdTime: createdTime?.toISOString(),
        },
        await createZip([name + ".jsonld", JSON.stringify(linkedDataList)])
      );
    },
    areResourcesUploaded: async (files) => {
      const hashQuery = files
        .map(
          (hashUri) =>
            `appProperties has { key='hashLink' and value='${hashUri}' }`
        )
        .join(" or ");
      const q = [
        "trashed=false",
        `(${hashQuery})`, // only created by binder
        `'${dirs.app}' in parents`,
      ].join(" and ");
      const query = encodeURI(q);
      const remoteFiles = await findFiles(token, query);
      return new Set(filterUndefined(remoteFiles.map((it) => it.hashUri)));
    },
    downloadResourceFileByHash: async (hash) => {
      const file = await findByHash(token, [dirs.app], hash);
      if (file === undefined) {
        return;
      }
      const response = await getFileContent(token, file.fileId);
      return response.blob();
    },
    uploadResourceFile: (blob: Blob, hash: HashUri, name?: string) => {
      return createFile(
        token,
        {
          name: getFileName(hash, blob.type, name),
          mimeType: blob.type,
          parents: [dirs.app],
          appProperties: { hashLink: hash },
        },
        blob
      );
    },
    listLinkedDataCreatedSince: (createdSince) => {
      const query = encodeURI(
        [
          "trashed=false",
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
