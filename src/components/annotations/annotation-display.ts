import type { Callback } from "linki";
import {
  cast,
  defined,
  filter,
  fork,
  link,
  map,
  nextTick,
  passOnlyChanged,
  push,
  to,
  withOptionalState,
} from "linki";
import type { JsonHtml, UiComponent, View } from "linki-ui";
import {
  button,
  dangerousHtml,
  div,
  dom,
  focusElement,
  mountComponent,
  renderJsonHtmlToDom,
  span,
} from "linki-ui";

import { CATEGORIES_ENABLED } from "../../config";
import { throwIfNull } from "../../libs/errors";
import type { HashUri } from "../../libs/hash";
import { getHash } from "../../libs/linked-data";
import { clearableDelay } from "../../libs/linki";
import {
  filterState,
  newStateHandler,
  newStateMapper,
} from "../../libs/named-state";
import { moreActions } from "../common/drop-down";
import { editor } from "../common/editor";
import { multiSelect } from "../common/multi-select";
import { relativeDateOfAction } from "../common/relative-date";

import type { Annotation, AnnotationSelector } from "./annotation";
import type { Position } from "./selection";

// noinspection JSUnusedGlobalSymbols
const annotationView: View<{
  categoriesSlot: JsonHtml;
  onHover: (state: DisplayAnnotation) => void;
  onHoverOut: () => void;
  onDelete: (id: HashUri) => void;
  state: DisplayAnnotation;
  position: Position;
  annotation: Annotation;
}> = ({
  categoriesSlot,
  onHover,
  onHoverOut,
  onDelete,
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
      onMouseLeave: onHoverOut,
      onMouseEnter: () => onHover(state),
    },
    div(
      {
        class: "Popover-message Popover-message--top color-shadow-large",
        style: {
          // width: "auto",
          maxWidth: "350px",
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
              handler: link(
                push(annotation),
                map(cast(), getHash),
                filter(defined),
                onDelete
              ),
            },
          ],
        })
      ),
      ...(CATEGORIES_ENABLED ? [categoriesSlot] : []),
      ...(annotation.body
        ? [
            div(
              {
                class: "Box-body",
              },
              dangerousHtml(annotation.body.value)
            ),
          ]
        : [])
    )
  );

type DisplayAnnotation = { position: Position; annotation: Annotation };
export type AnnotationDisplayState =
  | ["hidden"]
  | ["visible", DisplayAnnotation];

export const annotationDisplay: UiComponent<
  {
    displayAnnotation: DisplayAnnotation;
    hideAnnotation: void;
    hideAnnotationDelayed: void;
  },
  { deleteAnnotation: HashUri }
> = ({ deleteAnnotation, render }) => {
  const [categoriesSlot] = mountComponent(
    multiSelect({ extraClass: "p-0 m-0 width-full" })
  );

  const renderPopup = link(
    map(
      newStateMapper<AnnotationDisplayState, JsonHtml | undefined>(undefined, {
        visible: (state) => {
          const { position, annotation } = state;
          return annotationView({
            position,
            annotation,
            state,
            categoriesSlot,
            onHover: (state) => displayAnnotation(state),
            onHoverOut: () => delayedHide(),
            onDelete: fork(deleteAnnotation, () => hide()),
          });
        },
      })
    ),
    render
  );

  const handleData: Callback<AnnotationDisplayState> = link(
    passOnlyChanged<AnnotationDisplayState>(["hidden"]),
    renderPopup
  );

  const hide = link(push(["hidden"] as AnnotationDisplayState), handleData);
  const [delayedHide, cleanDelay] = link(clearableDelay<void>(100), hide);

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
  onCreateComment: (comment: string) => void;
  onHide: () => void;
}> = ({ position: [left, top], onCreateComment, onHide }) => {
  const [editorRoot, { save }] = mountComponent(
    editor({ style: { minHeight: "80px", width: "200px" } }),
    {
      onSave: onCreateComment,
      onEscape: onHide,
    }
  );

  const editorComponent = renderJsonHtmlToDom(editorRoot) as HTMLElement;
  const editorDom = throwIfNull(editorComponent.firstChild) as HTMLElement;
  link(map(to(editorDom)), nextTick(), focusElement);
  return div(
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
        dom(editorComponent)
      ),
      div(
        { class: "Box-footer text-right p-1" },
        button(
          {
            type: "button",
            class: "btn btn-sm btn-secondary mr-1",
            onClick: onHide,
          },
          "Cancel"
        ),
        button(
          {
            type: "button",
            class: "btn btn-sm btn-primary",
            onClick: () => save(),
          },
          "Save"
        )
      )
    )
  );
};

type Selection = {
  selector: AnnotationSelector;
};
export type CommentFormState =
  | ["hidden"]
  | ["visible", Selection & { position: Position }];

export const commentForm: UiComponent<
  { displayCommentForm: CommentFormState },
  {
    onCreatedComment: Selection & {
      comment: string;
    };
    onHide: Selection;
  }
> = ({ onCreatedComment, onHide, render }) => {
  const [hide, setSelectionForHide, resetSelection] = link(
    withOptionalState<Selection>(),
    filter(defined),
    onHide
  );

  const renderForm = link(
    map(
      newStateMapper<CommentFormState, JsonHtml>(undefined, {
        visible: ({ position, ...selection }) =>
          commentFormView({
            position,
            onHide: () => {
              hide();
              renderForm(["hidden"]);
            },
            onCreateComment: (comment) => {
              hide();
              onCreatedComment({
                comment,
                selector: selection.selector,
              });
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
