import type { Callback } from "linki";
import { and, filter, fork, link, map, or, to } from "linki";
import type { JsonHtml, View, Render } from "linki-ui";
import {
  a,
  div,
  h2,
  header,
  renderJsonHtmlToDom,
  dom,
  dangerousHtml,
  h3,
  button,
  textarea,
  inputValue,
  resetInput,
} from "linki-ui";

import type {
  CompletionSubscribeIndex,
  SearchCompletionIndex,
} from "../../functions/indexes/completion-index";
import type { HabitSubscribeIndex } from "../../functions/indexes/habit-index";
import type { Day, Instant } from "../../libs/calendar-ld";
import { getIntervalData } from "../../libs/calendar-ld";
import { throwIfUndefined } from "../../libs/errors";
import type { LinkedData } from "../../libs/jsonld-format";
import { span } from "../../libs/simple-ui/render";
import {
  hasCtrlKey,
  hasMetaKey,
  isKey,
} from "../../libs/simple-ui/utils/funtions";
import { formatDateTime, formatTime } from "../../libs/time";
import type { Annotation } from "../annotations/annotation";
import type {
  AnnotationsFeeder,
  AnnotationsSaver,
  AnnotationSaveProps,
} from "../annotations/service";
import { inline, stack } from "../common/spacing";
import type { Uri } from "../common/uri";
import { habitsView } from "../productivity/habits";
import { tasksView } from "../productivity/tasks";

const formatDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeZone: "UTC",
}).format;

const dayJournalHeader: View<{
  day: Day;
  dayDate: Date;
}> = ({ day, dayDate }) =>
  header(
    { class: "text-center" },
    h2(formatDate(dayDate)),
    inline(
      { class: "flex-justify-center" },
      a(
        {
          href: day.intervalMetBy,
        },
        "← previous"
      ),
      // a(
      //   {
      //     href: day.intervalMeets,
      //   },
      //   "week"
      // ),
      a(
        {
          href: day.intervalMeets,
        },
        "next →"
      )
    )
  );

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

const annotationView = (currentDate: Date): View<Annotation> => (annotation) =>
  div(
    {
      class: "Box Box--condensed",
    },
    div(
      { class: "Box-header d-flex flex-items-center" },
      div(
        { class: "flex-auto" },
        dateOrTimeOfAction({
          action: "commented",
          currentDate,
          date: new Date(annotation.created),
        })
      )
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

export const createAppendRenderer = (root: HTMLElement): Render => (
  jsonHtml
) => {
  const dom = renderJsonHtmlToDom(
    jsonHtml !== null && jsonHtml !== void 0 ? jsonHtml : undefined
  );
  root.appendChild(dom);
};

export const dayJournal = ({
  day,
  annotationFeeder,
  saveAnnotation,
  subscribeCompletable,
  subscribeHabits,
  saveLinkedData,
  searchCompletionIndex,
}: {
  day: Day;
  annotationFeeder: AnnotationsFeeder;
  saveAnnotation: AnnotationsSaver;
  subscribeCompletable: CompletionSubscribeIndex;
  subscribeHabits: HabitSubscribeIndex;
  saveLinkedData: Callback<LinkedData>;
  searchCompletionIndex: SearchCompletionIndex;
}): JsonHtml => {
  const annotationsRoot = renderJsonHtmlToDom(stack()) as HTMLElement;
  const renderAnnotations = createAppendRenderer(annotationsRoot);
  const dayUri = day["@id"];
  const dayDate = new Date(
    (throwIfUndefined(
      getIntervalData(day.hasBeginning)
    ) as Instant).inXSDDateTimeStamp
  );
  link(
    annotationFeeder,
    map(annotationView(dayDate)),
    renderAnnotations
  )({ reference: dayUri });

  return div(
    { class: "with-line-length-settings my-10" },
    dayJournalHeader({
      day,
      dayDate,
    }),
    stack(
      { gap: "large" },
      stack(
        { gap: "medium" },
        div(h2("Comments"), dom(annotationsRoot)),
        div(
          h3({ class: "h4" }, "Add comment"),
          annotationForm({ dayUri, onSave: saveAnnotation })
        )
      ),
      habitsView({ day, subscribe: subscribeHabits, saveLinkedData }),
      tasksView({
        saveLinkedData,
        subscribe: subscribeCompletable,
        searchCompletionIndex,
        day,
      })
    )
  );
};
