import "./style.css";

import type { Callback } from "linki";
import { cast, link, map } from "linki";
import type { View } from "linki-ui";
import { article, dom } from "linki-ui";

import { throttleArg } from "../../../../../libs/throttle";
import type { DocumentChange } from "../html-editable/document-change";
import { newDocumentComparator } from "../html-editable/document-change";

// ideally should be triggered on resize too
const detectDocumentChange = (
  contentRoot: Node,
  onChange: (c: DocumentChange[]) => void
) => (e: InputEvent) =>
  throttleArg<Element>(
    link(map(newDocumentComparator(contentRoot)), onChange),
    300
  )(e.target as HTMLElement);

export const editableHtmlView: View<{
  onDocumentChange: Callback<DocumentChange[]>;
  content: Node;
}> = ({ onDocumentChange, content }) =>
  article(
    {
      contentEditable: "true",
      class:
        "editable main-article markdown-body with-display-settings flex-1 position-relative",
      style: { outline: "none" },
      onInput: link(cast(), detectDocumentChange(content, onDocumentChange)),
    },
    dom(content)
  );

export const htmlView: View<{
  extraClass?: string;
  content: Node;
}> = ({ extraClass, content }) =>
  article(
    {
      class:
        "main-article markdown-body with-display-settings flex-1 position-relative" +
        (extraClass ? " " + extraClass : ""),
      style: {
        fontSize: "1em",
        lineHeight: "inherit",
      },
    },
    dom(content)
  );
