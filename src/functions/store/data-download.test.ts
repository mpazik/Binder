import "isomorphic-fetch";
import { jsonLdMimeType, LinkedDataWithHashId } from "../../libs/jsonld-format";
import { newArgCapture } from "../../libs/test-utils/arg-capture";
import {
  linkedData1,
  linkedData2,
  linkedData3,
} from "../../libs/test-utils/linked-data-examples";
import {
  jsonResponse,
  notFoundResponse,
  okResponse,
} from "../../libs/test-utils/response";
import { createZip } from "../../libs/zip";

import { createDataDownloader } from "./data-download";
import { extractLinkedDataFromResponse } from "./link-data-response-extractor";

type TestFileId = string;

describe("dataDownloader", () => {
  const sinceTime = new Date(2000, 10, 10);

  const remoteFileResponse = new Map<TestFileId, () => Promise<Response>>([
    ["file1", async () => jsonResponse(linkedData1, jsonLdMimeType)],
    [
      "file2",
      async () => jsonResponse([linkedData1, linkedData2], jsonLdMimeType),
    ],
    [
      "file3",
      async () =>
        okResponse(
          await createZip(
            ["test1.jsonld", linkedData1],
            ["test2.jsonld", [linkedData3, linkedData2]],
            ["test.txt", "Hello world"]
          )
        ),
    ],
  ]);

  const filesCreatedSince = new Map<Date | undefined, TestFileId[]>([
    [undefined, ["file1", "file2", "file3"]],
    [sinceTime, ["file3"]],
  ]);

  const newDownloader = async () => {
    const [
      writeLinkedData,
      getStoredLinkedData,
    ] = newArgCapture<LinkedDataWithHashId>();
    const download = createDataDownloader<TestFileId>(
      async (date) => filesCreatedSince.get(date) ?? [],
      async (fileId) => remoteFileResponse.get(fileId)?.() ?? notFoundResponse,
      async (it) => writeLinkedData(it),
      extractLinkedDataFromResponse
    );
    return { download, getStoredLinkedData };
  };

  test("downloads files since last modification time", async () => {
    const { download, getStoredLinkedData } = await newDownloader();

    await download(sinceTime);

    expect(getStoredLinkedData()).toEqual([
      linkedData1,
      linkedData3,
      linkedData2,
    ]);
  });

  test("downloads all files", async () => {
    const { download, getStoredLinkedData } = await newDownloader();

    await download(undefined);

    expect(getStoredLinkedData()).toEqual([
      linkedData1,
      linkedData1,
      linkedData2,
      linkedData1,
      linkedData3,
      linkedData2,
    ]);
  });
});
