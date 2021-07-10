import {
  ExternalLinkedDataStoreWrite,
  LinkedDataStoreRead,
} from "../../functions/store/local-store";
import { HashUri } from "../hash";
import { LinkedDataWithHashId } from "../jsonld-format";

export interface MockedLinkedDataStore {
  readLinkedData: LinkedDataStoreRead;
  writeLinkedData: ExternalLinkedDataStoreWrite;
  getStoredLinkedData: () => LinkedDataWithHashId[];
}

export const newMockedLinkedDataStore = (): MockedLinkedDataStore => {
  const existingFiles = new Map<HashUri, LinkedDataWithHashId>();

  return {
    readLinkedData: async (hash) => existingFiles.get(hash),
    writeLinkedData: async (linkedData) => {
      existingFiles.set(linkedData["@id"], linkedData);
    },
    getStoredLinkedData: () => Array.from(existingFiles.values()),
  };
};
