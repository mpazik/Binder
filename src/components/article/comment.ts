import { fork, Provider } from "../../libs/connections";
import {
  and,
  closableMap,
  delayedState,
  filter,
  map,
  or,
  setupContext,
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
  focusElement,
  getTarget,
  hasCtrlKey,
  hasMetaKey,
  isKey,
} from "../../libs/simple-ui/utils/funtions";

import { Annotation, createAnnotation } from "./annotation";
import {
  Position,
  quoteSelectorForSelection,
  renderTemporarySelector,
} from "./highlights";
import { rangePositionRelative } from "./selection-toolbar";

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
  position: Position;
  onDisplay: (editor: HTMLElement) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ position: [left, top], onSave, onCancel, onDisplay }) =>
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
          onKeydown: filter(
            and(isKey("Enter"), or(hasMetaKey, hasCtrlKey)),
            onSave
          ),
          onDisplay: map(getTarget, fork(focusElement, onDisplay)),
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

export type CommentFormState = ["hidden"] | ["visible", { position: Position }];

export const commentForm2: Component<{
  commentFormProvider: Provider<CommentFormState>;
  onCreatedComment: (comment: string) => void;
}> = ({ commentFormProvider, onCreatedComment }) => (render) => {
  const [withEditorContext, setEditor, resetEditor] = setupContext<
    HTMLElement
  >();

  const renderForm = map(
    newStateMapper<CommentFormState, JsonHtml | undefined>({
      visible: ({ position }) =>
        commentFormView({
          position,
          onDisplay: setEditor,
          onCancel: () => {
            renderForm(["hidden"]);
          },
          onSave: () => {
            withEditorContext(map((it) => it.innerHTML, onCreatedComment));
            renderForm(["hidden"]);
          },
        }),
      hidden: () => undefined,
    }),
    render
  );

  commentFormProvider(
    fork(
      renderForm,
      filter<CommentFormState>(([name]) => name === "hidden", resetEditor)
    )
  );
};

export const commentForm: Component<{
  commentFormProvider: Provider<WithContainerContext<Range>>;
  onCreatedComment: (c: Annotation) => void;
}> = ({ commentFormProvider, onCreatedComment }) => (render) => {
  const [withEditorContext, setEditor, resetEditor] = setupContext<
    HTMLElement
  >();

  const renderForm = closableMap(
    (data: WithContainerContext<Range> | undefined, onClose) => {
      if (!data) {
        resetEditor();
        return;
      }
      const { container, text, data: range } = data;
      const position = rangePositionRelative(range, container);
      const quoteSelector = quoteSelectorForSelection(container, text, range);
      const [remove] = renderTemporarySelector(container, text, quoteSelector);
      onClose(remove);

      return commentFormView({
        position,
        onDisplay: setEditor,
        onCancel: () => {
          renderForm(undefined);
        },
        onSave: () => {
          withEditorContext((editor) => {
            onCreatedComment(
              createAnnotation("something", quoteSelector, editor.innerHTML)
            );
          });
          renderForm(undefined);
        },
      });
    },
    render
  );

  commentFormProvider(renderForm);
};
