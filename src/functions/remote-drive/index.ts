import { HashUri } from "../../libs/hash";
import { LinkedDataWithHashId } from "../../libs/jsonld-format";

export interface RemoteDrive<FileId = unknown> {
  downloadLinkedData: (fileId: FileId) => Promise<Response>;
  uploadLinkedData: (
    data: LinkedDataWithHashId[],
    creationTime?: Date
  ) => Promise<FileId>;
  areResourcesUploaded: (files: HashUri[]) => Promise<Set<HashUri>>;
  downloadResourceFileByHash: (fileHash: HashUri) => Promise<Blob | undefined>;
  uploadResourceFile: (
    blob: Blob,
    hash: HashUri,
    name?: string
  ) => Promise<FileId>;
  listLinkedDataCreatedSince: (date: Date | undefined) => Promise<FileId[]>;
  listLinkedDataCreatedUntil: (date: Date | undefined) => Promise<FileId[]>;
  deleteFile: (fileId: FileId) => Promise<void>;
}

export type RemoteDriverState = ["off"] | ["on", RemoteDrive] | ["loading"];
