import { Callback } from "../../libs/connections";
import { map } from "../../libs/connections/mappers";
import { article, View } from "../../libs/simple-ui/render";
import { getTarget } from "../../libs/simple-ui/utils/funtions";

export const editableHtmlView: View<{
  content: HTMLElement;
  onInput: Callback<InputEvent>;
  onDisplay?: Callback<HTMLElement>;
  sendSelection?: () => void;
}> = ({ content, onInput, onDisplay, sendSelection }) =>
  article({
    contenteditable: true,
    class: "editable markdown-body flex-1",
    style: { outline: "none" },
    onInput: onInput,
    dangerouslySetDom: content,
    onMouseup: sendSelection,
    onFocusout: sendSelection,
    onDisplay: onDisplay ? map(getTarget, onDisplay) : undefined,
  });

export const htmlView: View<{
  content: HTMLElement;
  onDisplay?: Callback<HTMLElement>;
  sendSelection?: () => void;
}> = ({ content, onDisplay, sendSelection }) =>
  article({
    class: "markdown-body flex-1",
    dangerouslySetDom: content,
    onMouseup: sendSelection,
    onFocusout: sendSelection,
    onDisplay: onDisplay ? map(getTarget, onDisplay) : undefined,
  });
