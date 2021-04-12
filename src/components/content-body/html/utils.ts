import {
  getDocumentContentRoot,
  parseArticleContent,
} from "../../../functions/content-processors/html-processor";

import { HtmlContent } from "./view";

export const processToDocument = async (content: Blob): Promise<Document> =>
  parseArticleContent(await content.text());

export const documentToHtmlContent = (
  contentDocument: Document
): HtmlContent => ({ content: getDocumentContentRoot(contentDocument) });

export const processToHtml = async (content: Blob): Promise<HtmlContent> =>
  documentToHtmlContent(await processToDocument(content));
