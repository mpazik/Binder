import { dangerousHtml } from "linki-ui";

import type { PageView } from "../system/page";

import { errorPage } from "./error";

export const staticPage: PageView = (controller, linkedData) => {
  if (
    !linkedData ||
    !linkedData.articleBody ||
    typeof linkedData.articleBody !== "string"
  )
    return errorPage(controller, linkedData);
  return dangerousHtml(linkedData.articleBody);
};
