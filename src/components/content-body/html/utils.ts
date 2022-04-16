import type { Callback } from "linki";

import {
  getDocumentContentRoot,
  parseArticleContent,
} from "../../../functions/content-processors/html-processor";
import type { DisplayContext } from "../types";
import { scrollToTop } from "../utils";

export const processToDocument = async (content: Blob): Promise<Document> =>
  parseArticleContent(await content.text());

export const processToHtml = async (content: Blob): Promise<Node> =>
  getDocumentContentRoot(await processToDocument(content));

export const scrollToPageTopWhenNoFragment: Callback<DisplayContext> = (
  context
) => {
  // if there is no page fragment go to top of the page to show linked data, ideally it should be the top of the full content container
  if (context.fragment) return;
  scrollToTop();
};
