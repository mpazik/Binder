import type { Callback } from "linki";
import { link } from "linki";
import type { View, UiComponent } from "linki-ui";
import {
  a,
  div,
  h2,
  header,
  renderJsonHtmlToDom,
  dom,
  mountComponent,
} from "linki-ui";

import type { AnnotationsSubscribe } from "../../functions/indexes/annotations-index";
import type {
  CompletionSubscribe,
  SearchCompletionIndex,
} from "../../functions/indexes/completion-index";
import type { HabitSubscribe } from "../../functions/indexes/habit-index";
import { documentLinksUriProvider } from "../../functions/url-hijack";
import type { UriWithFragment } from "../../libs/browser-providers";
import type { Day, Instant } from "../../libs/calendar-ld";
import { getIntervalData } from "../../libs/calendar-ld";
import { throwIfUndefined } from "../../libs/errors";
import type { LinkedData } from "../../libs/jsonld-format";
import type { AnnotationsSaver } from "../annotations/service";
import { inline, stack } from "../common/spacing";
import { habits } from "../productivity/habits";
import { tasks } from "../productivity/tasks";

import { comments } from "./comments";

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

export const dayJournal = ({
  day,
  annotationSubscribe,
  saveAnnotation,
  subscribeCompletable,
  subscribeHabits,
  saveLinkedData,
  searchCompletionIndex,
  loadUri,
}: {
  day: Day;
  annotationSubscribe: AnnotationsSubscribe;
  saveAnnotation: AnnotationsSaver;
  subscribeCompletable: CompletionSubscribe;
  subscribeHabits: HabitSubscribe;
  saveLinkedData: Callback<LinkedData>;
  searchCompletionIndex: SearchCompletionIndex;
  loadUri: Callback<UriWithFragment>;
}): UiComponent => ({ render }) => {
  const dayDate = new Date(
    (throwIfUndefined(
      getIntervalData(day.hasBeginning)
    ) as Instant).inXSDDateTimeStamp
  );

  const [tasksSlot] = mountComponent(
    tasks({
      saveLinkedData,
      subscribe: subscribeCompletable,
      searchCompletionIndex,
      day,
    })
  );
  const [habitsSlot] = mountComponent(
    habits({ day, subscribe: subscribeHabits, saveLinkedData })
  );
  const [commentsSlot] = mountComponent(
    comments({
      day,
      dayDate,
      subscribe: annotationSubscribe,
      saveAnnotation,
      saveLinkedData,
    })
  );

  const navigation = renderJsonHtmlToDom(
    dayJournalHeader({
      day,
      dayDate,
    })
  );
  render(
    div(
      { class: "with-line-length-settings my-10" },
      dom(navigation),
      stack({ gap: "large" }, commentsSlot, habitsSlot, tasksSlot)
    )
  );
  return {
    stop: link(documentLinksUriProvider(navigation), loadUri),
  };
};
