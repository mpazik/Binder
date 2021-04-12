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
    onSelectionTrigger?: () => void;
  },
  HtmlContent
> = ({ onDocumentChange, onDisplay, onSelectionTrigger }) => ({ content }) =>
  article({
    contenteditable: true,
    class: "editable markdown-body flex-1",
    style: { outline: "none" },
    onInput: detectDocumentChange(content, onDocumentChange),
    dangerouslySetDom: content,
    onMouseup: onSelectionTrigger,
    onFocusout: onSelectionTrigger,
    onDisplay: onDisplay ? map(getTarget, onDisplay) : undefined,
  });

export const setupHtmlView: ViewSetup<
  {
    onDisplay?: Callback<HTMLElement>;
    onSelectionTrigger?: () => void;
  },
  HtmlContent
> = ({ onDisplay, onSelectionTrigger }) => ({ content }) =>
  article({
    class: "markdown-body flex-1",
    dangerouslySetDom: content,
    onMouseup: onSelectionTrigger,
    onFocusout: onSelectionTrigger,
    onDisplay: onDisplay ? map(getTarget, onDisplay) : undefined,
  });
