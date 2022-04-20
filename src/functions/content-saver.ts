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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { "@id": _, ...linkedDataToSave } = linkedData;
    const urls = [...getUrls(linkedData).filter((uri) => !isHashUri(uri))];

    if (content) {
      const contentHash = await storeWrite(content, linkedData.name as string);
      urls.push(contentHash);
    }
    linkedDataToSave["url"] = urls;

    return {
      linkedData: await ldStoreWrite(linkedDataToSave),
      content,
    };
  };
};
