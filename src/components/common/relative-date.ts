import type { View } from "linki-ui";
import { span } from "linki-ui";

import { formatDateTime, formatRelativeTime } from "../../libs/time";

export const relativeDate: View<{ date: Date; defaultStyle?: boolean }> = ({
  date,
  defaultStyle = true,
}) =>
  span(
    {
      ...(defaultStyle ? { class: "color-text-secondary" } : {}),
      title: formatDateTime(date),
    },
    formatRelativeTime(new Date(date))
  );

export const relativeDateOfAction: View<{ date: Date; action: string }> = ({
  date,
  action,
}) =>
  span(
    { class: "color-text-secondary" },
    action,
    ": ",
    relativeDate({ date, defaultStyle: false })
  );
