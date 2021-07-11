import { asyncPool } from "../../libs/async-pool";
import { RemoteDrive } from "../remote-drive";

import { LinkDateResponseExtractor } from "./link-data-response-extractor";
import { ExternalLinkedDataStoreWrite } from "./local-store";

export type DataDownload = (since: Date | undefined) => Promise<void>;

export const createDataDownloader = <FileId>(
  listLinkedDataCreatedSince: RemoteDrive<FileId>["listLinkedDataCreatedSince"],
  downloadFile: RemoteDrive<FileId>["downloadLinkedData"],
  saveLinkedData: ExternalLinkedDataStoreWrite,
  extractLinkedDataFromResponse: LinkDateResponseExtractor
): DataDownload => async (since) => {
  const fileModifiedSinceLastCheck = await listLinkedDataCreatedSince(since);

  await asyncPool(fileModifiedSinceLastCheck, async (fileId) => {
    const response = await downloadFile(fileId);
    await extractLinkedDataFromResponse(response, saveLinkedData);
  });
};
