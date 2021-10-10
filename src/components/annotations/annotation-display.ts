import type { Callback } from "linki";
import {
  and,
  defined,
  filter,
  fork,
  link,
  map,
  or,
  passOnlyChanged,
  to,
  withOptionalState,
} from "linki";
import { valueWithOptionalState } from "linki/dist/processors/reduce";

import { CATEGORIES_ENABLED } from "../../config";
import { throwIfNull } from "../../libs/errors";
import { clearableDelay } from "../../libs/linki";
import {
  filterState,
  newStateHandler,
  newStateMapper,
} from "../../libs/named-state";
import type {
  Component,
  JsonHtml,
  OptionalJsonHtml,
  Slot,
  View,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { button, div, newSlot, span } from "../../libs/simple-ui/render";
import {
  focusElement,
  getTarget,
  hasCtrlKey,
  hasMetaKey,
  isKey,
} from "../../libs/simple-ui/utils/funtions";
import { moreActions } from "../common/drop-down";
import { multiSelect } from "../common/multi-select";
import { relativeDateOfAction } from "../common/relative-date";

import type { Annotation, AnnotationSelector } from "./annotation";
import type { Position } from "./selection";

const createAnnotationView: ViewSetup<
  {
    categoriesSlot: Slot;
    onHover: (state: DisplayAnnotation) => void;
    onHoverOut: () => void;
  },
  {
    state: DisplayAnnotation;
    position: Position;
    annotation: Annotation;
  }
> = ({ categoriesSlot, onHover, onHoverOut }) => ({
  position: [left, top],
  annotation,
  state,
}) =>
  div(
    {
      class: "Box Box--condensed Popover",
      style: {
        left: `${left}px`,
        top: `${top}px`,
        transform: "translate(-50%, 8px)",
      },
      onMouseleave: onHoverOut,
      onMouseenter: () => onHover(state),
    },
    div(
      {
        class: "Popover-message Popover-message--top color-shadow-large",
        style: {
          // width: "auto",
          maxWidth: 350,
        },
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
      ...(CATEGORIES_ENABLED ? [categoriesSlot] : []),
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

type DisplayAnnotation = { position: Position; annotation: Annotation };
export type AnnotationDisplayState =
  | ["hidden"]
  | ["visible", DisplayAnnotation];

export const annotationDisplay: Component<
  void,
  {
    displayAnnotation: DisplayAnnotation;
    hideAnnotation: void;
    hideAnnotationDelayed: void;
  }
> = () => (render) => {
  const [categoriesSlot] = newSlot(
    "categories",
    multiSelect({ extraClass: "p-0 m-0 width-full" })
  );

  const annotationView = createAnnotationView({
    categoriesSlot,
    onHover: (state) => displayAnnotation(state),
    onHoverOut: () => delayedHide(),
  });

  const renderPopup = link(
    map(
      newStateMapper<AnnotationDisplayState, JsonHtml | undefined>(undefined, {
        visible: (state) => {
          const { position, annotation } = state;
          return annotationView({
            position,
            annotation,
            state,
          });
        },
      })
    ),
    render
  );

  const handleData: Callback<AnnotationDisplayState> = link(
    passOnlyChanged<AnnotationDisplayState>(),
    renderPopup
  );

  const [delayedHide, cleanDelay] = link(
    clearableDelay<void>(300),
    map(to(["hidden"] as AnnotationDisplayState)),
    handleData
  );

  const displayAnnotation: Callback<DisplayAnnotation> = fork(
    (data) => handleData(["visible", data]),
    () => cleanDelay()
  );

  return {
    displayAnnotation,
    hideAnnotation: () => handleData(["hidden"]),
    hideAnnotationDelayed: () => delayedHide(),
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
        left: `${left}px`,
        top: `${top}px`,
        transform: "translate(-50%, 30px)",
      },
    },
    div(
      {
        class:
          "Popover-message Popover-message--top color-shadow-large width-auto",
      },
      div(
        {
          class: "Box-body p-2",
        },
        div({
          class: "form-control p-1",
          style: { "min-height": "80px", width: "300px" },
          contenteditable: true,
          onKeydown: fork(
            link(
              filter(and(isKey("Enter"), or(hasMetaKey, hasCtrlKey))),
              onSave
            ),
            link(filter(isKey("Escape")), onCancel)
          ),
          onDisplay: map(getTarget, fork(focusElement, onDisplay)),
          onPaste: (event) => {
            event.preventDefault();
            const text = event.clipboardData?.getData("text/plain");
            if (text) {
              document.execCommand("insertHTML", false, text);
            }
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

type Selection = {
  selector: AnnotationSelector;
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
  const [createComment, setContainer] = link(
    valueWithOptionalState<HTMLElement, Selection>(),
    ([editor, { selector }]) => {
      onCreatedComment({
        comment: throwIfNull(editor).innerHTML,
        selector,
      });
    }
  );

  const [hide, setSelectionForHide, resetSelection] = link(
    withOptionalState<Selection>(),
    filter(defined),
    onHide
  );

  const renderForm = link(
    map(
      newStateMapper<CommentFormState, OptionalJsonHtml>(undefined, {
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
      })
    ),
    render
  );

  return {
    displayCommentForm: fork(
      renderForm,
      link(filterState("hidden"), hide),
      newStateHandler({
        visible: setSelectionForHide,
        hidden: resetSelection,
      })
    ),
  };
};
