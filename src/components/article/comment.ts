import { Provider } from "../../libs/connections";
import {
  closableMap,
  delayedState,
  map,
  statefulMap,
} from "../../libs/connections/processors2";
import { newStateMapper } from "../../libs/named-state";
import {
  button,
  Component,
  div,
  JsonHtml,
  View,
} from "../../libs/simple-ui/render";

import {
  Position,
  quoteSelectorForSelection,
  renderTemporarySelector,
} from "./highlights";
import { rangePositionRelative } from "./selection-toolbar";
import { Annotation, createAnnotation } from "./annotation";

export type WithContainerContext<T> = {
  container: HTMLElement;
  text: string;
  data: T;
};

const commentView: View<{
  position: Position;
  content: string;
  onHover: () => void;
  onHoverOut: () => void;
}> = ({ position: [left, top], content, onHover, onHoverOut }) =>
  div(
    {
      class: "Box Popover",
      style: {
        left,
        top,
        transform: "translate(-50%, 30px)",
      },
      onMouseleave: onHoverOut,
      onMouseenter: onHover,
    },
    div({
      class: "Popover-message Popover-message--top box-shadow-large p-2",
      style: {},
      dangerouslySetInnerHTML: content,
    })
  );

export type CommentDisplayState =
  | ["hidden"]
  | ["visible", { position: Position; content: string }];

export const commentDisplay: Component<{
  commentProvider: Provider<CommentDisplayState>;
}> = ({ commentProvider }) => (render) => {
  const renderPopup = map(
    newStateMapper<CommentDisplayState, JsonHtml | undefined>({
      visible: (state) => {
        const { position, content } = state;
        return commentView({
          position,
          content,
          onHover: () => {
            handleData(["visible", state]);
          },
          onHoverOut: () => {
            handleData(["hidden"]);
          },
        });
      },
      hidden: () => {
        return undefined;
      },
    }),
    render
  );
  const handleData = delayedState(["hidden"], 200, renderPopup);
  commentProvider(handleData);
};

const commentFormView: View<{
  top: number;
  left: number;
  onDisplay: (editor: HTMLElement) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ top, left, onSave, onCancel, onDisplay }) =>
  div(
    {
      class: "Box Popover",
      style: {
        left,
        top,
        transform: "translate(-50%, 30px)",
      },
    },
    div(
      {
        class:
          "Popover-message Popover-message--top box-shadow-large width-auto",
      },
      div(
        {
          class: "Box-body p-2",
        },
        div({
          class: "form-control p-1",
          style: { "min-height": "80px", width: "200px" },
          contenteditable: true,
          onDisplay: (event) => {
            const target = event.target as HTMLElement;
            target.focus();
            onDisplay(target);
          },
        })
      ),
      div(
        { class: "Box-footer text-right p-1" },
        button(
          {
            type: "button",
            class: "btn btn-sm btn-secondary mr-1",
            onClick: onCancel,
          },
          "Cancel"
        ),
        button(
          { type: "button", class: "btn btn-sm btn-primary", onClick: onSave },
          "Save"
        )
      )
    )
  );

export const commentForm: Component<{
  commentFormProvider: Provider<WithContainerContext<Range>>;
  onCreatedComment: (c: Annotation) => void;
}> = ({ commentFormProvider, onCreatedComment }) => (render) => {
  const [mapWithEditor, setEditor, resetEditor] = statefulMap<HTMLElement>();

  const renderForm = closableMap(
    (data: WithContainerContext<Range> | undefined, onClose) => {
      if (!data) {
        resetEditor();
        return;
      }
      const { container, text, data: range } = data;
      const [left, top] = rangePositionRelative(range, container);
      const quoteSelector = quoteSelectorForSelection(container, text, range);
      const [remove] = renderTemporarySelector(container, text, quoteSelector);
      onClose(remove);

      return commentFormView({
        top,
        left,
        onDisplay: setEditor,
        onCancel: () => {
          renderForm(undefined);
        },
        onSave: mapWithEditor<void, HTMLElement>(
          (_, editor) => editor,
          (editor) => {
            onCreatedComment(
              createAnnotation("something", quoteSelector, editor.innerHTML)
            );
            renderForm(undefined);
          }
        ),
      });
    },
    render
  );

  commentFormProvider(renderForm);
};
