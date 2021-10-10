import type { JsonHtml } from "../../libs/simple-ui/render";
import { span } from "../../libs/simple-ui/render";

export const maxLengthText = (text: string, limit: number): JsonHtml =>
  text.length <= limit
    ? text
    : span(
        {
          class:
            "tooltipped tooltipped-se tooltipped-multiline tooltipped-align-left-1",
          "aria-label": text,
        },
        text.substring(0, limit - 3) + "..."
      );
