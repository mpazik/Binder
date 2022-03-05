import type { Options } from "jsonld";
import { expand, normalize } from "jsonld";
import type { NodeObject } from "jsonld/jsonld";
import type { JsonLd } from "jsonld/jsonld-spec";
import type { URL } from "schema-dts";

import { isAbsoluteUrl } from "../components/common/link";
import activitystream from "../vocabulary/activitystreams-context.json";
import annotations from "../vocabulary/annoations-context.json";
import schemaorg from "../vocabulary/schema-org-context.json";

import { throwIfNull } from "./errors";
import type { HashName, HashUri } from "./hash";
import { isHashUri } from "./hash";
import type { LinkedData, LinkedDataWithHashId } from "./jsonld-format";

const contexts = new Map<string, JsonLd>([
  ["http://www.w3.org/ns/anno.jsonld", annotations as JsonLd],
  ["https://www.w3.org/ns/activitystreams", activitystream as JsonLd],
  ["https://schema.org", schemaorg as JsonLd],
]);

const contextLoader: Options.DocLoader["documentLoader"] = (url) => {
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

export const getHash = (ld: LinkedDataWithHashId): HashName => ld["@id"];

export const getType = (ld: LinkedData): string | undefined =>
  ld["@type"] ?? (ld["type"] as string);

export const getContext = (ld: LinkedData): NodeObject["@context"] =>
  ld["@context"];

export const isLinkedData = (data: unknown): data is LinkedData => {
  if (!data || typeof data !== "object") return false;
  const type = getType(data as LinkedData);
  const context = getContext(data as LinkedData);
  return type !== undefined && context !== undefined;
};

export const isTypeEqualTo = (ld: LinkedData, type: string): boolean => {
  const ldType = getType(ld);
  if (!ldType) return false;
  return ldType === type;
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

const textEncoder = new TextEncoder();

export const normalizeLinkedData = async (
  data: LinkedData
): Promise<ArrayBuffer> => {
  const normalized = await normalize(data, {
    documentLoader: contextLoader,
    algorithm: "URDNA2015",
  });
  return textEncoder.encode(normalized).buffer;
};

export const validateLinkedData = async (
  data: LinkedData
): Promise<string[]> => {
  const validateObject = (objs: Record<string, unknown>[]): string[] => {
    const errors = [];
    for (const obj of objs) {
      const keys = Object.keys(obj);
      for (const key of keys) {
        if (key.startsWith("@")) {
          if (key === "@id") {
            const id = obj[key] as string;
            if (!isAbsoluteUrl(id)) {
              errors.push(`id '${id}' is not an absolute URI`);
            }
          }
          if (key === "@type") {
            const types = (Array.isArray(obj[key])
              ? obj[key]
              : [obj[key]]) as string[];
            for (const type of types) {
              if (!isAbsoluteUrl(type)) {
                errors.push(`type '${type}' is not an absolute URI`);
              }
            }
          }
        } else {
          if (!isAbsoluteUrl(key)) {
            errors.push(
              `property '${key}' has not have absolute URI to the definition`
            );
          }
          errors.push(...validateObject(obj[key] as Record<string, unknown>[]));
        }
      }
    }
    return errors;
  };

  const expanded = await expand(data, { documentLoader: contextLoader });
  return validateObject(expanded);
};
