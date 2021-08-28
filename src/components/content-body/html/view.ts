import { Callback } from "../../../libs/connections";
import { map } from "../../../libs/connections/mappers";
import { article, ViewSetup } from "../../../libs/simple-ui/render";
import { getTarget } from "../../../libs/simple-ui/utils/funtions";
import { throttleArg } from "../../../libs/throttle";
import {
  DocumentChange,
  newDocumentComparator,
} from "../html-editable/document-change";

export type HtmlContent = { content: HTMLElement };

// ideally should be triggered on resize too
const detectDocumentChange = (
  contentRoot: HTMLElement,
  onChange: (c: DocumentChange[]) => void
) => (e: InputEvent) =>
  throttleArg<Element>(
    map(newDocumentComparator(contentRoot), onChange),
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
    class: "editable markdown-body flex-1 position-relative",
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
      "markdown-body flex-1 position-relative" +
      (extraClass ? " " + extraClass : ""),
    style: { fontSize: "1em" },
    dangerouslySetDom: content,
    onDisplay: onDisplay ? map(getTarget, onDisplay) : undefined,
  });
