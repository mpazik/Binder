import type { View } from "linki-ui";
import { div, h2, header, pre } from "linki-ui";

import type { Day, Instant } from "../../libs/calendar-ld";
import { getIntervalData } from "../../libs/calendar-ld";
import { throwIfUndefined } from "../../libs/errors";
import { a } from "../../libs/simple-ui/render";
import { inline } from "../common/spacing";

const formatDateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeZone: "UTC",
}).format;

export const dayJournal: View<Day> = (data) => {
  const date = new Date(
    (throwIfUndefined(
      getIntervalData(data.hasBeginning)
    ) as Instant).inXSDDateTimeStamp
  );
  return div(
    { class: "with-line-length-settings my-10" },
    header(
      { class: "text-center" },
      h2(formatDateTime(date)),
      inline(
        { class: "flex-justify-center" },
        a(
          {
            href: data.intervalMetBy,
          },
          "← yesterday"
        ),
        a(
          {
            href: data.intervalMeets,
          },
          "week"
        ),
        a(
          {
            href: data.intervalMeets,
          },
          "tomorrow →"
        )
      )
    ),
    pre(JSON.stringify(data, null, 4))
  );
};
