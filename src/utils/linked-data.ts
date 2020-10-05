import { HashName } from "./hash";

export type LinkedData = {
  "@context": string;
  "@type": string;
  encodingFormat: string;
  name: string;
  url: string[];
};

export const fileExtension = "jsonld";

export type LinkedDataWithHash = {
  hash: HashName;
  ld: LinkedData;
};
