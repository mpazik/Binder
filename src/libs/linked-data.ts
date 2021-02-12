import { NodeObject, normalize } from "jsonld";
import { URL } from "schema-dts";

import { HashName, HashUri, isHashUri } from "./hash";

export const jsonldFileExtension = "jsonld";

export type LinkedData = NodeObject;
export type LinkedDataWithHashId = LinkedData & { "@id": HashUri };

export const getHash = (ld: LinkedDataWithHashId): HashName => ld["@id"];

export const findUri = (ld: LinkedData): URL | undefined => {
  const urls = [(ld["url"] as URL | URL[]) || []].flat();
  return urls.find((it) => !isHashUri(it));
};

export const findHashUri = (ld: LinkedData): HashUri | undefined => {
  const urls = [ld.url || []].flat() as string[];
  return urls.find((it) => isHashUri(it)) as HashUri;
};

export const jsonLdMimeType = "application/ld+json";

const textEncoder = new TextEncoder();
export const normalizeLinkedData = (data: LinkedData): Promise<ArrayBuffer> =>
  normalize(data, {
    algorithm: "URDNA2015",
  }).then((normalized) => textEncoder.encode(normalized).buffer);
