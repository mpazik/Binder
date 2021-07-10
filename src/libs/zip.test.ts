import { newArgCapture } from "./test-utils/arg-capture";
import { createZip, openJsonZipFiles } from "./zip";

const processZip = async (zip: Blob, regExp?: RegExp): Promise<unknown[]> => {
  const [captureData, getCapturedData] = newArgCapture<unknown>();
  await openJsonZipFiles(zip, async (it) => captureData(it), regExp);
  return getCapturedData();
};

describe("openZipCompressedLinkedData", () => {
  const file1 = { prop: "value" };
  const file2 = { something: "else" };

  test("handles single json file", async () => {
    const zip = await createZip(["test.json", file1]);

    expect(await processZip(zip)).toEqual([file1]);
  });

  test("handles single json with different format", async () => {
    const zip = await createZip(["test.json", file1], ["test2.jsonld", file2]);

    expect(await processZip(zip, /.*\.jsonld/)).toEqual([file2]);
  });

  test("handles multiple file", async () => {
    const zip = await createZip(
      ["test1.json", file1],
      ["test2.json", file2],
      ["test.txt", "Hello world"]
    );

    expect(await processZip(zip)).toEqual([file1, file2]);
  });

  test("handle no json data", async () => {
    const zip = await createZip(["test.txt", "Hello world"]);

    expect(await processZip(zip)).toEqual([]);
  });

  test("handle empty zip archive", async () => {
    const zip = await createZip();

    expect(await processZip(zip)).toEqual([]);
  });
});
