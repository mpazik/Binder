import type { Callback } from "../../../../linki";
import { and, filter, fork, head, link, map, or, to } from "../../../../linki";
import type { UiComponent, UiItemComponent, View } from "../../../../linki-ui";
import {
  button,
  dangerousHtml,
  div,
  dom,
  h2,
  h3,
  inputValue,
  mountItemComponent,
  renderJsonHtmlToDom,
  resetInput,
  span,
  textarea,
} from "../../../../linki-ui";
import type { AnnotationsSubscribe } from "../../functions/indexes/annotations-index";
import type { Day } from "../../libs/calendar-ld";
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
import type { Annotation } from "../annotations/annotation";
import type {
  AnnotationsSaver,
  AnnotationSaveProps,
} from "../annotations/service";
import { moreActions } from "../common/drop-down-linki-ui";
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

const annotationForm: View<{
  dayUri: Uri;
  onSave: Callback<AnnotationSaveProps>;
}> = ({ dayUri, onSave }) => {
  const saveData = link(
    map(to(() => formDom)),
    fork(
      link(
        map(inputValue, (content) => ({
          reference: dayUri,
          content,
          selector: undefined,
        })),
        onSave
      ),
      resetInput
    )
  );

  const formDom = renderJsonHtmlToDom(
    textarea({
      class: "form-control p-1",
      style: { width: "100%" },
      rows: 4,
      contentEditable: "true",
      onKeyDown: fork(
        link(filter(and(isKey("Enter"), or(hasMetaKey, hasCtrlKey))), saveData)
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
  return div(
    div(dom(formDom)),
    div(
      { class: "text-right py-1" },
      button(
        { type: "button", class: "btn btn-sm btn-primary", onClick: saveData },
        "Add"
      )
    )
  );
};

const getId = (it: Annotation) =>
  getHash((it as unknown) as LinkedDataWithHashId);

export const comments = ({
  day,
  dayDate,
  subscribe,
  saveAnnotation,
  saveLinkedData,
}: {
  day: Day;
  dayDate: Date;
  subscribe: AnnotationsSubscribe;
  saveAnnotation: AnnotationsSaver;
  saveLinkedData: Callback<LinkedData>;
}): UiComponent => ({ render }) => {
  const dayUri = day["@id"];

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
      div(
        h3({ class: "h4" }, "Add comment"),
        annotationForm({ dayUri, onSave: saveAnnotation })
      )
    )
  );
  return {
    stop: link(subscribe({ reference: dayUri }), changeComments),
  };
};
