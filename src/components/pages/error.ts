import { div, pre } from "linki-ui";

import type { PageView } from "../system/page";

export const errorPage: PageView = (controller, context) =>
  div({}, "Error", pre(JSON.stringify(context)));
