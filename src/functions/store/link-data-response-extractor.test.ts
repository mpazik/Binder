import type { LinkedDataWithHashId } from "../../libs/jsonld-format";
import { jsonLdMimeType } from "../../libs/jsonld-format";
import { newArgCapture } from "../../libs/test-utils/arg-capture";
import {
  linkedData1,
  linkedData2,
} from "../../libs/test-utils/linked-data-examples";
import { jsonResponse, okResponse } from "../../libs/test-utils/response";
import { createZip } from "../../libs/zip";

import { extractLinkedDataFromResponse } from "./link-data-response-extractor";

describe("downloadNewData", () => {
  const extract = async (
    response: Response
  ): Promise<LinkedDataWithHashId[]> => {
    const [capture, getData] = newArgCapture<LinkedDataWithHashId>();
    await extractLinkedDataFromResponse(response, async (it) => capture(it));
    return getData();
  };

  test("can handle jsonld response", async () => {
    const extracted = await extract(jsonResponse(linkedData1, jsonLdMimeType));

    expect(extracted).toEqual([linkedData1]);
  });

  test("can handle combined jsonld response", async () => {
    const extracted = await extract(
      jsonResponse([linkedData1, linkedData2], jsonLdMimeType)
    );

    expect(extracted).toEqual([linkedData1, linkedData2]);
  });

  test("can handle zip response", async () => {
    const extracted = await extract(
      okResponse(
        await createZip(
          ["test1.jsonld", linkedData1],
          ["test2.jsonld", [linkedData1, linkedData2]],
          ["test.txt", "Hello world"]
        )
      )
    );

    expect(extracted).toEqual([linkedData1, linkedData1, linkedData2]);
  });

  test("can handle empty zip response", async () => {
    const extracted = await extract(okResponse(await createZip()));

    expect(extracted).toEqual([]);
  });
});
