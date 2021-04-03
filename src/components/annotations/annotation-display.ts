import { fork, withState } from "../../libs/connections";
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
  span,
  View,
} from "../../libs/simple-ui/render";
import {
  focusElement,
  getTarget,
  hasCtrlKey,
  hasMetaKey,
  isKey,
} from "../../libs/simple-ui/utils/funtions";
import { moreActions } from "../common/more-acctions";
import { relativeDateOfAction } from "../common/relative-date";

import { Annotation, QuoteSelector } from "./annotation";
import { Position } from "./selection";

const annotationView: View<{
  position: Position;
  annotation: Annotation;
  onHover: () => void;
  onHoverOut: () => void;
}> = ({ position: [left, top], annotation, onHover, onHoverOut }) =>
  div(
    {
      class: "Box Box--condensed Popover",
      style: {
        left,
        top,
        transform: "translate(-50%, 30px)",
      },
      onMouseleave: onHoverOut,
      onMouseenter: onHover,
    },
    div(
      {
        class: "Popover-message Popover-message--top box-shadow-large",
      },
      div(
        { class: "Box-header d-flex flex-items-center" },
        span(
          { class: "flex-auto" },
          relativeDateOfAction({
            action:
              annotation.motivation === "commenting"
                ? "commented"
                : "highlighted",
            date: new Date(annotation.created),
          })
        ),
        moreActions({
          actions: [
            {
              label: "Delete",
              handler: () => alert("Deleting is not supported yet"),
            },
          ],
        })
      ),
      ...(annotation.body
        ? [
            div({
              class: "Box-body",
              dangerouslySetInnerHTML: annotation.body.value,
            }),
          ]
        : [])
    )
  );

export type AnnotationDisplayState =
  | ["hidden"]
  | ["visible", { position: Position; annotation: Annotation }];

export const annotationDisplay: Component<
  void,
  {
    displayAnnotation: AnnotationDisplayState;
  }
> = () => (render) => {
  const renderPopup = map(
    newStateMapper<AnnotationDisplayState, JsonHtml | undefined>({
      visible: (state) => {
        const { position, annotation } = state;
        return annotationView({
          position,
          annotation,
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
    displayAnnotation: handleData,
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
  const [createComment, setContainer] = withState<HTMLElement, Selection>(
    (editor, { selector, container }) => {
      onCreatedComment({
        comment: throwIfNull(editor).innerHTML,
        selector,
        container,
      });
    }
  );

  const [hide, setSelectionForHide, resetSelection] = withState<Selection>(
    onHide
  );

  const renderForm = map(
    newStateMapper<CommentFormState, JsonHtml | undefined>({
      visible: ({ position, ...selection }) =>
        commentFormView({
          position,
          onDisplay: setContainer,
          onCancel: () => {
            hide();
            renderForm(["hidden"]);
          },
          onSave: () => {
            hide();
            createComment(selection);
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
      filter<CommentFormState>(([name]) => name === "hidden", hide),
      newStateHandler({
        visible: setSelectionForHide,
        hidden: resetSelection,
      })
    ),
  };
};
