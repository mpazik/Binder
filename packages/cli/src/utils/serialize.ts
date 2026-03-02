import * as YAML from "yaml";
import { serializeDsv } from "./dsv.ts";

export const serializeItemFormats = ["json", "yaml"] as const;
export type SerializeItemFormat = (typeof serializeItemFormats)[number];
export const serializeFormats = [
  "json",
  "jsonl",
  "yaml",
  "csv",
  "tsv",
] as const;
export type SerializeFormat = (typeof serializeFormats)[number];

/** Formats that serialize a flat list of items (no pagination wrapper). */
export const flatListFormats: SerializeFormat[] = ["jsonl", "csv", "tsv"];

export const serialize = <T>(
  data: T | T[],
  format: SerializeFormat,
  map?: (item: T) => unknown,
): string => {
  const mapped = map ? (Array.isArray(data) ? data.map(map) : map(data)) : data;

  if (format === "csv" || format === "tsv") {
    const items = Array.isArray(mapped) ? mapped : [mapped];
    return serializeDsv(items, format === "csv" ? "," : "\t");
  }
  if (format === "jsonl") {
    const items = Array.isArray(mapped) ? mapped : [mapped];
    return items.map((item) => JSON.stringify(item)).join("\n");
  }
  if (format === "json") return JSON.stringify(mapped, null, 2);
  return YAML.stringify(mapped);
};
