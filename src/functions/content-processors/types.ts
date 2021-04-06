import { LinkedData, LinkedDataWithHashId } from "../../libs/linked-data";

export type LinkedDataWithContent = {
  content: Blob;
  linkedData: LinkedData;
};
export type SavedLinkedDataWithContent = {
  content: Blob;
  linkedData: LinkedDataWithHashId;
};
export type LinkedDataWithDocument = {
  contentDocument: Document;
  linkedData: LinkedData;
};

export type RawContentProps = {
  name?: string;
  createTime?: string;
  url?: string;
};
export type ContentProcessor = {
  mediaType: string | string[];
  process: (
    blob: Blob,
    props: RawContentProps
  ) => Promise<LinkedDataWithContent>;
};
