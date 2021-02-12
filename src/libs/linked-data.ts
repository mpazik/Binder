import { NodeObject, normalize } from "jsonld";
import { URL } from "schema-dts";

import { throwIfNull } from "./errors";
import { HashName, HashUri, isHashUri } from "./hash";

export const jsonldFileExtension = "jsonld";

export type LinkedData = NodeObject;
export type LinkedDataWithHashId = LinkedData & { "@id": HashUri };

export const getHash = (ld: LinkedDataWithHashId): HashName => ld["@id"];

export const getPropertyValue = <T = string>(
  ld: LinkedData,
  property: string
): T => {
  const propertyValues = getPropertyValues<T>(ld, property);
  return throwIfNull(propertyValues.length === 0 ? null : propertyValues[0]);
};

export const getPropertyValues = <T>(ld: LinkedData, property: string): T[] => {
  const value = (ld[property] as unknown) as T | T[] | undefined;
  return [value ?? []].flat() as T[];
};
export const getUrls = (ld: LinkedData): URL[] => getPropertyValues(ld, "url");

export const findUrl = (ld: LinkedData): URL | undefined =>
  getUrls(ld).find((it) => !isHashUri(it));

export const findHashUri = (ld: LinkedData): HashUri | undefined =>
  getUrls(ld).find((it) => isHashUri(it)) as HashUri;

export const jsonLdMimeType = "application/ld+json";

const textEncoder = new TextEncoder();
export const normalizeLinkedData = (data: LinkedData): Promise<ArrayBuffer> =>
  normalize(data, {
    algorithm: "URDNA2015",
  }).then((normalized) => textEncoder.encode(normalized).buffer);
