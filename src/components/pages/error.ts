import { div, h1, h3, pre } from "linki-ui";

import type { PageView } from "../system/page";

export const errorPage: PageView = (controller, context) =>
  div(
    { class: "flash mt-3 flash-error" },
    h1("Error displaying the page"),
    h3("Page input:"),
    pre(JSON.stringify(context))
  );
