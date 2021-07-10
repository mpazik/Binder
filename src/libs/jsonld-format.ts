import { NodeObject } from "jsonld";

import { HashUri } from "./hash";

export const jsonldFileExtension = "jsonld";
export const jsonLdMimeType = "application/ld+json";

export type LinkedData = NodeObject;
export type LinkedDataWithHashId = LinkedData & { "@id": HashUri };
export const serializeLinkedData = (ld: LinkedDataWithHashId): Blob =>
  new Blob([JSON.stringify(ld)], {
    type: jsonLdMimeType,
  });
