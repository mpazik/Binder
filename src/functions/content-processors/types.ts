import type {
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/jsonld-format";

export type LinkedDataWithContent = {
  content: Blob;
  linkedData: LinkedData;
};

export type SavedLinkedDataWithContent = {
  content: Blob;
  linkedData: LinkedDataWithHashId;
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
