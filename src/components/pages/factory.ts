import { dom } from "linki-ui";

import type { LinkedData } from "../../libs/jsonld-format";
import type { PageView } from "../system/page";

import { errorPage } from "./error";

export const pageFactory = (pageData: LinkedData): PageView => (controller) => {
  if (
    pageData &&
    pageData.articleBody &&
    pageData.articleBody instanceof HTMLElement
  ) {
    return dom(pageData.articleBody as HTMLElement);
  }

  return errorPage(controller, pageData);
};
