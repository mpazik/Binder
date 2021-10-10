import type { LinkedDataWithHashId } from "../../libs/jsonld-format";
import { jsonLdMimeType } from "../../libs/jsonld-format";
import { openJsonZipFiles, zipMimeType } from "../../libs/zip";

export type LinkDateResponseExtractor = (
  response: Response,
  callback: (data: LinkedDataWithHashId) => Promise<void>
) => Promise<void>;

type StoredLinkedData = LinkedDataWithHashId | LinkedDataWithHashId[];

export const extractLinkedDataFromResponse: LinkDateResponseExtractor = async (
  response,
  callback
): Promise<void> => {
  const handleLinkedData = async (linkedData: StoredLinkedData) => {
    if (Array.isArray(linkedData)) {
      for (const item of linkedData) {
        await callback(item);
      }
    } else {
      await callback(linkedData);
    }
  };

  switch (response.headers.get("content-type")) {
    case jsonLdMimeType: {
      const linkedData = await response.json();
      await handleLinkedData(linkedData);
      return;
    }
    case zipMimeType: {
      const blob = await response.blob();
      await openJsonZipFiles<StoredLinkedData>(
        blob,
        handleLinkedData,
        /.*\.jsonld/
      );
      return;
    }
    default:
      throw new Error("Un supported response type for extracting linked data");
  }
};
