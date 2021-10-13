import { isHashUri } from "../libs/hash";
import { getUrls } from "../libs/linked-data";

import type {
  LinkedDataWithContent,
  SavedLinkedDataWithContent,
} from "./content-processors";
import type { LinkedDataStoreWrite, ResourceStoreWrite } from "./store";

export type ContentSaver = (
  data: LinkedDataWithContent
) => Promise<SavedLinkedDataWithContent>;

export const createContentSaver = (
  storeWrite: ResourceStoreWrite,
  ldStoreWrite: LinkedDataStoreWrite
): ContentSaver => {
  return async ({ content, linkedData }) => {
    const contentHash = await storeWrite(content, linkedData.name as string);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { "@id": _, ...linkedDataWithContentHashUri } = linkedData;
    linkedDataWithContentHashUri["url"] = [
      ...getUrls(linkedData).filter((uri) => !isHashUri(uri)),
      contentHash,
    ];
    return {
      linkedData: await ldStoreWrite(linkedDataWithContentHashUri),
      content,
    };
  };
};
