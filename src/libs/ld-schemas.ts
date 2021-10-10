import type { Article, CreativeWork, WithContext } from "schema-dts";

import type { LinkedData } from "./jsonld-format";

export const htmlMediaType = "text/html";
export const pdfMediaType = "application/pdf";
export const epubMediaType = "application/epub+zip";
export type EncodingFormat =
  | typeof htmlMediaType
  | typeof pdfMediaType
  | typeof epubMediaType
  | string;

export const createCreativeWork = ({
  id,
  type = "CreativeWork",
  name,
  encodingFormat,
  urls,
  dateCreated,
}: {
  id?: string;
  type?: "CreativeWork" | "Article" | "Book";
  name: string;
  encodingFormat: EncodingFormat;
  dateCreated?: string;
  urls?: string[];
}): WithContext<CreativeWork> => ({
  "@context": "https://schema.org",
  "@type": type,
  ...(id ? { "@id": id } : {}),
  encodingFormat,
  name,
  dateCreated,
  url: urls,
});

export const createArticle = (props: {
  id?: string;
  name: string;
  encodingFormat: EncodingFormat;
  dateCreated?: string;
  urls?: string[];
}): WithContext<Article> =>
  createCreativeWork({ ...props, type: "Article" }) as WithContext<Article>;

export const getEncoding = (ld: LinkedData): EncodingFormat | undefined =>
  ld["encodingFormat"] as string;
