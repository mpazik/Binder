import { asyncPool } from "../../libs/async-pool";
import { RemoteDrive } from "../remote-drive";

import { LinkDateResponseExtractor } from "./link-data-response-extractor";
import { ExternalLinkedDataStoreWrite } from "./local-store";

type DataDownloader = (since: Date | undefined) => Promise<void>;

export const createDataDownloader = <FileId>(
  listFilesCreatedSince: RemoteDrive<FileId>["listFilesCreatedSince"],
  downloadFile: RemoteDrive<FileId>["downloadLinkedDataFile"],
  saveLinkedData: ExternalLinkedDataStoreWrite,
  extractLinkedDataFromResponse: LinkDateResponseExtractor
): DataDownloader => async (since) => {
  const fileModifiedSinceLastCheck = await listFilesCreatedSince(since);

  await asyncPool(3, fileModifiedSinceLastCheck, async (fileId) => {
    const response = await downloadFile(fileId);
    await extractLinkedDataFromResponse(response, saveLinkedData);
  });
};
