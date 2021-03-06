import { NodeObject, normalize, Options } from "jsonld";
import { JsonLd } from "jsonld/jsonld-spec";
import { URL } from "schema-dts";

import annotations from "../schema/anno.json";
import schemaorg from "../schema/schemaorg.json";

import { throwIfNull } from "./errors";
import { HashName, HashUri, isHashUri } from "./hash";

import DocLoader = Options.DocLoader;

export const jsonldFileExtension = "jsonld";

const contexts = new Map<string, JsonLd>([
  ["http://www.w3.org/ns/anno.jsonld", annotations as JsonLd],
  ["https://schema.org", schemaorg as JsonLd],
]);

const contextLoader: DocLoader["documentLoader"] = (url) => {
  const context = contexts.get(url);
  if (!context) {
    console.error(`Could not find context for ${url}`);
    return Promise.reject(`Could not find context for ${url}`);
  }
  return Promise.resolve({
    document: context,
    documentUrl: url,
  });
};

export type LinkedData = NodeObject;
export type LinkedDataWithHashId = LinkedData & { "@id": HashUri };

export const getHash = (ld: LinkedDataWithHashId): HashName => ld["@id"];

export const isTypeEqualTo = (ld: LinkedData, type: string): boolean => {
  if (ld["@type"] && ld["@type"]?.toLowerCase() === type) return true;
  return Boolean(
    ld["type"] &&
      typeof ld["type"] === "string" &&
      ld["type"]?.toLowerCase() === type
  );
};

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
    documentLoader: contextLoader,
    algorithm: "URDNA2015",
  }).then((normalized) => textEncoder.encode(normalized).buffer);
