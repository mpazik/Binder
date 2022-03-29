import type { Callback } from "linki";
import {
  and,
  filter,
  fork,
  head,
  ignoreParam,
  link,
  map,
  or,
  push,
  splitDefined,
  to,
  valueWithState,
} from "linki";
import type { JsonHtml, UiComponent, UiItemComponent, View } from "linki-ui";
import {
  button,
  dangerousHtml,
  div,
  dom,
  h2,
  inputValue,
  mountItemComponent,
  renderJsonHtmlToDom,
  resetInput,
  span,
  textarea,
} from "linki-ui";

import type {
  AnnotationChange,
  AnnotationsSubscribe,
} from "../../functions/indexes/annotations-index";
import type { IntervalUri } from "../../libs/calendar-ld";
import type {
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/jsonld-format";
import { getHash } from "../../libs/linked-data";
import {
  hasCtrlKey,
  hasMetaKey,
  isKey,
} from "../../libs/simple-ui/utils/funtions";
import { formatDateTime, formatTime } from "../../libs/time";
import { createDelete } from "../../vocabulary/activity-streams";
import type {
  Annotation,
  AnnotationMotivation,
} from "../annotations/annotation";
import type {
  AnnotationSaveProps,
  AnnotationsSaver,
} from "../annotations/service";
import { moreActions } from "../common/drop-down-linki-ui";
import {
  defaultRating,
  ratingForLinkedData,
  ratingProp,
  ratingSelect,
} from "../common/rating";
import { stack } from "../common/spacing";
import type { Uri } from "../common/uri";

const dateTimeOfAction: View<{ date: Date; action: string }> = ({
  date,
  action,
}) =>
  span({ class: "color-text-secondary" }, action, " on ", formatDateTime(date));

const timeOfAction: View<{ date: Date; action: string }> = ({ date, action }) =>
  span({ class: "color-text-secondary" }, action, " at ", formatTime(date));

const sameDay = (date1: Date, date2: Date) =>
  date1.getFullYear() === date2.getFullYear() &&
  date1.getMonth() === date2.getMonth() &&
  date1.getDay() === date2.getDay();

const dateOrTimeOfAction: View<{
  date: Date;
  currentDate: Date;
  action: string;
}> = ({ date, currentDate, action }) =>
  sameDay(date, currentDate)
    ? timeOfAction({ date, action })
    : dateTimeOfAction({ date, action });

const createCommentView = (
  currentDate: Date,
  onDelete: () => void
): View<Annotation> => (annotation) =>
  div(
    {
      class: "Box Box--condensed",
    },
    div(
      { class: "Box-header d-flex flex-items-center" },
      span(
        { class: "flex-auto" },
        dateOrTimeOfAction({
          action: "commented",
          currentDate,
          date: new Date(annotation.created),
        })
      ),
      moreActions({
        actions: [
          {
            label: "Delete",
            handler: () => onDelete(),
          },
        ],
      })
    ),
    annotation.body
      ? div(
          {
            class: "Box-body",
          },
          dangerousHtml(annotation.body!.value)
        )
      : undefined
  );

const createCommentComponent = (
  currentDate: Date
): UiItemComponent<Annotation, { onDelete: void }> => ({
  render,
  onDelete,
}) => {
  return {
    updateItem: link(map(createCommentView(currentDate, onDelete)), render),
  };
};

const annotationTextarea = (saveData: Callback) =>
  renderJsonHtmlToDom(
    textarea({
      class: "form-control p-1",
      style: { width: "100%" },
      rows: 4,
      onKeyDown: fork(
        link(
          filter(and(isKey("Enter"), or(hasMetaKey, hasCtrlKey))),
          ignoreParam(),
          saveData
        )
      ),
      onPaste: (event) => {
        event.preventDefault();
        const text = event.clipboardData?.getData("text/plain");
        if (text) {
          document.execCommand("insertHTML", false, text);
        }
      },
    })
  ) as HTMLInputElement;

const commentForm: View<{
  intervalUri: Uri;
  onSave: Callback<AnnotationSaveProps>;
}> = ({ intervalUri, onSave }) => {
  const saveData = link(
    map(to(() => formDom)),
    fork(
      link(
        map(inputValue, (content) => ({
          reference: intervalUri,
          content,
        })),
        onSave
      ),
      resetInput
    )
  );
  const formDom = annotationTextarea(saveData);
  return div(
    dom(formDom),
    div(
      { class: "text-right py-1" },
      button(
        { type: "button", class: "btn btn-sm btn-primary", onClick: saveData },
        "Add comment"
      )
    )
  );
};

const getId = (it: Annotation) =>
  getHash((it as unknown) as LinkedDataWithHashId);

export const comments = ({
  intervalUri,
  dayDate,
  subscribe,
  saveAnnotation,
  saveLinkedData,
}: {
  intervalUri: Uri;
  dayDate: Date;
  subscribe: AnnotationsSubscribe;
  saveAnnotation: AnnotationsSaver;
  saveLinkedData: Callback<LinkedData>;
}): UiComponent => ({ render }) => {
  const [commentsSlot, { changeItems: changeComments }] = mountItemComponent(
    getId,
    createCommentComponent(dayDate),
    { onDelete: link(map(head(), createDelete), saveLinkedData) },
    { parent: renderJsonHtmlToDom(stack()) as HTMLElement }
  );

  render(
    stack(
      { gap: "medium" },
      div(h2("Comments"), commentsSlot),
      div(commentForm({ intervalUri, onSave: saveAnnotation }))
    )
  );
  return {
    stop: link(
      subscribe({ reference: intervalUri, motivation: "commenting" }),
      changeComments
    ),
  };
};

const reviewForm: View<{
  intervalUri: Uri;
  onSave: Callback<AnnotationSaveProps>;
}> = ({ intervalUri, onSave }) => {
  const saveData = link(
    map(to(() => textareaDom)),
    link(
      map(inputValue, (content) => ({
        reference: intervalUri,
        content,
        motivation: "assessing" as AnnotationMotivation,
      })),
      onSave
    )
  );

  const textareaDom = annotationTextarea(saveData) as HTMLInputElement;
  return div(
    dom(textareaDom),
    div(
      { class: "text-right py-1" },
      button(
        { type: "button", class: "btn btn-sm btn-primary", onClick: saveData },
        "Add review"
      )
    )
  );
};

const rating: View<Annotation> = (annotation) =>
  span(
    { class: "ml-2 flex-auto" },
    ratingForLinkedData(annotation as LinkedData)
  );

const pickFirstAnnotation = (op: AnnotationChange): Annotation | undefined => {
  if (op[0] === "to") {
    if (op[1].length === 0) {
      return undefined;
    } else {
      return op[1][0];
    }
  } else if (op[0] === "set") {
    return op[1];
  } else if (op[0] === "del") {
    return undefined;
  }
};

export const review = ({
  intervalUri,
  subscribe,
  saveAnnotation,
  saveLinkedData,
}: {
  intervalUri: IntervalUri;
  subscribe: AnnotationsSubscribe;
  saveAnnotation: AnnotationsSaver;
  saveLinkedData: Callback<LinkedData>;
}): UiComponent => ({ render }) => {
  const renderAnnotation = link(
    map(
      (annotation: Annotation): JsonHtml =>
        stack(
          { gap: "medium" },
          div(
            { class: "d-flex flex-items-center" },
            h2("Review"),
            rating(annotation),
            moreActions({
              actions: [
                {
                  label: "Delete",
                  handler: link(
                    push(() =>
                      getHash((annotation as unknown) as LinkedDataWithHashId)
                    ),
                    map(createDelete),
                    saveLinkedData
                  ),
                },
              ],
            })
          ),
          div(
            {
              class: "Box Box--condensed",
            },
            annotation.body
              ? div(
                  {
                    class: "Box-body",
                  },
                  dangerousHtml(annotation.body!.value)
                )
              : undefined
          )
        )
    ),
    render
  );

  const [saveWithRating, setRating] = link(
    valueWithState<string, AnnotationSaveProps>(defaultRating),
    map(([rating, props]) =>
      rating
        ? {
            ...props,
            extra: { [ratingProp]: rating },
          }
        : props
    ),
    saveAnnotation
  );
  const renderForm = () => {
    setRating(defaultRating);
    render(
      stack(
        { gap: "medium" },
        div(
          { class: "d-flex flex-items-center" },
          h2("Review"),
          span(
            { class: "ml-2 flex-auto" },
            ratingSelect({ onChange: setRating })
          )
        ),
        div(
          reviewForm({
            intervalUri,
            onSave: saveWithRating,
          })
        )
      )
    );
  };

  return {
    stop: link(
      subscribe({ reference: intervalUri, motivation: "assessing" }),
      map(pickFirstAnnotation),
      splitDefined(),
      [renderAnnotation, renderForm]
    ),
  };
};

const readOnlyView: View<Annotation> = ({ body }) =>
  body
    ? div(
        {
          class: "Box Box--condensed",
        },
        div(
          {
            class: "Box-body",
          },
          dangerousHtml(body.value)
        )
      )
    : undefined;

export const readOnlyReviewBody = (
  intervalUri: IntervalUri,
  subscribe: AnnotationsSubscribe
): UiComponent => ({ render }) => {
  return {
    stop: link(
      subscribe({
        reference: intervalUri,
        motivation: "assessing",
      }),
      map(pickFirstAnnotation),
      splitDefined(),
      [link(map(readOnlyView), render), () => render(undefined)]
    ),
  };
};

export const readOnlyReviewRating = (
  intervalUri: IntervalUri,
  subscribe: AnnotationsSubscribe
): UiComponent => ({ render }) => {
  return {
    stop: link(
      subscribe({
        reference: intervalUri,
        motivation: "assessing",
      }),
      map(pickFirstAnnotation),
      splitDefined(),
      [link(map(rating), render), () => render(undefined)]
    ),
  };
};
