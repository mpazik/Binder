import { HashUri } from "../../libs/hash";
import { LinkedDataWithHashId } from "../../libs/jsonld-format";

export interface RemoteDrive<FileId> {
  downloadLinkedData: (fileId: FileId) => Promise<Response>;
  uploadLinkedData: (
    data: LinkedDataWithHashId[],
    creationTime?: Date
  ) => Promise<FileId>;
  areResourcesUploaded: (files: HashUri[]) => Promise<Set<HashUri>>;
  downloadResourceFile: (fileId: FileId) => Promise<Response>;
  uploadResourceFile: (
    blob: Blob,
    hash: HashUri,
    name?: string
  ) => Promise<FileId>;
  listLinkedDataCreatedSince: (date: Date | undefined) => Promise<FileId[]>;
  listLinkedDataCreatedUntil: (date: Date | undefined) => Promise<FileId[]>;
  deleteFile: (fileId: FileId) => Promise<void>;
}
