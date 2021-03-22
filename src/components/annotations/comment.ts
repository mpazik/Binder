import { fork } from "../../libs/connections";
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

import { QuoteSelector } from "./annotation";
import { Position } from "./selection";

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

export const commentDisplay: Component<
  void,
  {
    displayComment: CommentDisplayState;
  }
> = () => (render) => {
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
  return {
    displayComment: handleData,
  };
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

type Selection = {
  container: HTMLElement;
  selector: QuoteSelector;
};
export type CommentFormState =
  | ["hidden"]
  | ["visible", Selection & { position: Position }];

export const commentForm: Component<
  {
    onCreatedComment: (
      s: Selection & {
        comment: string;
      }
    ) => void;
    onHide: (s: Selection) => void;
  },
  { displayCommentForm: CommentFormState }
> = ({ onCreatedComment, onHide }) => (render) => {
  let editor: HTMLElement | undefined;
  let state: Selection | undefined;

  const renderForm = map(
    newStateMapper<CommentFormState, JsonHtml | undefined>({
      visible: ({ container, position, selector }) =>
        commentFormView({
          position,
          onDisplay: (e) => (editor = e),
          onCancel: () => {
            renderForm(["hidden"]);
          },
          onSave: () => {
            onCreatedComment({
              comment: throwIfNull(editor).innerHTML,
              selector,
              container,
            });
            renderForm(["hidden"]);
          },
        }),
      hidden: () => undefined,
    }),
    render
  );

  return {
    displayCommentForm: fork(
      renderForm,
      filter<CommentFormState>(
        ([name]) => name === "hidden",
        fork(
          () => (editor = undefined),
          () => onHide(throwIfNull(state))
        )
      ),
      newStateHandler({
        visible: (s) => (state = s),
        hidden: () => (state = undefined),
      })
    ),
  };
};
