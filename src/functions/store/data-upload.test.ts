import { HashUri } from "../../libs/hash";
import { newArgCapture } from "../../libs/test-utils/arg-capture";
import {
  linkedData1,
  linkedData2,
} from "../../libs/test-utils/linked-data-examples";

import { createDataUploader } from "./data-upload";

import { SyncRecord } from "./index";

describe("dataUploader", () => {
  const newUploader = (filesToSync: [string, SyncRecord][]) => {
    const [captureLinkedData, getUploadedLinkedData] = newArgCapture<
      HashUri[]
    >();
    const [captureResource, getUploadedResources] = newArgCapture<
      { hash: HashUri; name?: string }[]
    >();
    const [captureFileSync, getFileSynchronised] = newArgCapture<string>();

    const upload = createDataUploader<string>(
      async (it) => captureResource(it),
      async (it) => captureLinkedData(it),
      async () => filesToSync,
      async (it) => captureFileSync(it)
    );
    return {
      upload,
      getUploadedLinkedData,
      getUploadedResources,
      getFileSynchronised,
    };
  };

  test("uploads both resources and linked data and marks them and synchronised", async () => {
    const {
      upload,
      getUploadedLinkedData,
      getUploadedResources,
      getFileSynchronised,
    } = newUploader([
      [
        "file1",
        { hash: "text-txt-hash" as HashUri, ld: false, name: "text.txt" },
      ],
      [
        "file2",
        { hash: "text-txt-hash" as HashUri, ld: false, name: "text.txt" },
      ],
      ["file3", { hash: linkedData1["@id"], ld: true }],
      ["file4", { hash: linkedData2["@id"], ld: true }],
    ]);

    await upload();

    expect(getUploadedResources()).toEqual([
      [
        { hash: "text-txt-hash" as HashUri, ld: false, name: "text.txt" },
        { hash: "text-txt-hash" as HashUri, ld: false, name: "text.txt" },
      ],
    ]);
    expect(getUploadedLinkedData()).toEqual([
      [linkedData1["@id"], linkedData2["@id"]],
    ]);
    expect(getFileSynchronised()).toEqual(["file1", "file2", "file3", "file4"]);
  });

  test("does not mark resources as synchronised when there was an error updating them", async () => {});

  test("does not mark resources as synchronised when there was an error updating them", async () => {});
});

describe("resourceUploader", () => {
  test("uploads resources requiring sync one by one", async () => {});

  test("ignores resources that where removed from local store for some reason", async () => {});

  test("check if files are already uploaded to minimize chance for duplication", async () => {});
});

describe("linkedDataUploader", () => {
  test("uploads all linked data requiring sync in a single file", async () => {});

  test("ignores linked data that where removed from local store for some reason", async () => {});

  test("uploads all linked data in bulk file if number of files on remote drive is over the threshold ", async () => {});

  test("removes other linked data files after bulk linked data file was uploaded", async () => {});
  test("does not remove other linked data files if bulk linked data file upload failed", async () => {});
});
