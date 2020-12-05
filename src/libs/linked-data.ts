import { CreativeWork, URL } from "schema-dts";

import { HashName, HashUri, isHashUri } from "./hash";

export const fileExtension = "jsonld";

export type LinkedDataWithItsHash<Ld extends CreativeWork = CreativeWork> = {
  hash: HashName;
  ld: Ld;
};

export const getHash = (ld: LinkedDataWithItsHash): HashName => ld.hash;

export const findUri = (ld: CreativeWork): URL | undefined =>
  [ld.url || []].flat().find((it) => !isHashUri(it));

export const findHashUri = (ld: CreativeWork): HashUri | undefined =>
  [ld.url || []].flat().find((it) => isHashUri(it)) as HashUri;

export const jsonLdMimeType = "application/ld+json";
