import { fork, Provider } from "../../libs/connections";
import { delayedState } from "../../libs/connections";
import { and, filter, or } from "../../libs/connections/filters";
import { map } from "../../libs/connections/mappers";
import { throwIfNull } from "../../libs/errors";
import { newStateHandler, newStateMapper } from "../../libs/named-state";
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

import { Position, Selection, selectionPosition } from "./selection";

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
}> = ({ commentProvider }) => (render, onClose) => {
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
  commentProvider(onClose, handleData);
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
          onKeydown: fork(
            filter(and(isKey("Enter"), or(hasMetaKey, hasCtrlKey)), onSave),
            filter(isKey("Escape"), onCancel)
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

export type CommentFormState =
  | ["hidden"]
  | ["visible", { selection: Selection }];

export const commentForm: Component<{
  commentFormProvider: Provider<CommentFormState>;
  onCreatedComment: ({
    selection,
    comment,
  }: {
    selection: Selection;
    comment: string;
  }) => void;
  onHide: ({ selection }: { selection: Selection }) => void;
}> = ({ commentFormProvider, onCreatedComment, onHide }) => (
  render,
  onClose
) => {
  let editor: HTMLElement | undefined;
  let selection: Selection | undefined;

  const renderForm = map(
    newStateMapper<CommentFormState, JsonHtml | undefined>({
      visible: ({ selection }) =>
        commentFormView({
          position: selectionPosition(selection),
          onDisplay: (e) => (editor = e),
          onCancel: () => {
            renderForm(["hidden"]);
          },
          onSave: () => {
            onCreatedComment({
              comment: throwIfNull(editor).innerHTML,
              selection,
            });
            renderForm(["hidden"]);
          },
        }),
      hidden: () => undefined,
    }),
    render
  );

  commentFormProvider(
    onClose,
    fork(
      renderForm,
      filter<CommentFormState>(
        ([name]) => name === "hidden",
        fork(
          () => (editor = undefined),
          () => onHide({ selection: throwIfNull(selection) })
        )
      ),
      newStateHandler({
        visible: ({ selection: s }) => (selection = s),
        hidden: () => (selection = undefined),
      })
    )
  );
};
