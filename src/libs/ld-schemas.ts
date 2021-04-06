import { Article, WithContext } from "schema-dts";

import { LinkedData } from "./linked-data";

export type EncodingFormat = "text/html" | "application/pdf" | string;
export const htmlMediaType = "text/html";
export const pdfMediaType = "application/pdf";

export const createArticle = ({
  id,
  name,
  encodingFormat,
  urls,
  dateCreated,
}: {
  id?: string;
  name: string;
  encodingFormat: EncodingFormat;
  dateCreated?: string;
  urls?: string[];
}): WithContext<Article> => ({
  "@context": "https://schema.org",
  "@type": "Article",
  ...(id ? { "@id": id } : {}),
  encodingFormat,
  name,
  dateCreated,
  url: urls,
});

export const isEncodingEqualTo = (
  encoding: EncodingFormat
): ((ld: LinkedData) => boolean) => (ld: LinkedData) =>
  ld["encodingFormat"] === encoding;
