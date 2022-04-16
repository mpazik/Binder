import type { JsonHtml } from "linki-ui";
import { span } from "linki-ui";

export const maxLengthText = (text: string, limit: number): JsonHtml =>
  text.length <= limit
    ? text
    : span(
        {
          class:
            "tooltipped tooltipped-se tooltipped-multiline tooltipped-align-left-1",
        },
        text.substring(0, limit - 3) + "..."
      );
