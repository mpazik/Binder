import "./style.css";

import type { Callback } from "linki";
import { link, map } from "linki";

import type { ViewSetup } from "../../../libs/simple-ui/render";
import { article } from "../../../libs/simple-ui/render";
import { getTarget } from "../../../libs/simple-ui/utils/funtions";
import { throttleArg } from "../../../libs/throttle";
import type { DocumentChange } from "../html-editable/document-change";
import { newDocumentComparator } from "../html-editable/document-change";

export type HtmlContent = { content: Node };

// ideally should be triggered on resize too
const detectDocumentChange = (
  contentRoot: Node,
  onChange: (c: DocumentChange[]) => void
) => (e: InputEvent) =>
  throttleArg<Element>(
    link(map(newDocumentComparator(contentRoot)), onChange),
    300
  )(e.target as HTMLElement);

export const setupEditableHtmlView: ViewSetup<
  {
    onDocumentChange: Callback<DocumentChange[]>;
    onDisplay?: Callback<HTMLElement>;
  },
  HtmlContent
> = ({ onDocumentChange, onDisplay }) => ({ content }) =>
  article({
    contenteditable: true,
    class:
      "editable main-article markdown-body with-display-settings flex-1 position-relative",
    style: { outline: "none" },
    onInput: detectDocumentChange(content, onDocumentChange),
    dangerouslySetDom: content,
    onDisplay: onDisplay ? map(getTarget, onDisplay) : undefined,
  });

export const setupHtmlView: ViewSetup<
  {
    onDisplay?: Callback<HTMLElement>;
    extraClass?: string;
  },
  HtmlContent
> = ({ onDisplay, extraClass }) => ({ content }) =>
  article({
    class:
      "main-article markdown-body with-display-settings flex-1 position-relative" +
      (extraClass ? " " + extraClass : ""),
    style: {
      fontSize: "1em",
      lineHeight: "inherit",
    },
    dangerouslySetDom: content,
    onDisplay: onDisplay ? link(map(getTarget), onDisplay) : undefined,
  });
