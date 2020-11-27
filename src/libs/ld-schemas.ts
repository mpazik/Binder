import { Article, WithContext } from "schema-dts";

export const createArticle = (
  name: string,
  encodingFormat: string,
  urls?: string[]
): WithContext<Article> => ({
  "@context": "https://schema.org",
  "@type": "Article",
  encodingFormat,
  name,
  url: urls,
});
