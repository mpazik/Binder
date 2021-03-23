import { span, View } from "../../libs/simple-ui/render";
import { formatDateTime, formatRelativeTime } from "../../libs/time";

export const relativeDate: View<{ date: Date; defaultStyle?: boolean }> = ({
  date,
  defaultStyle = true,
}) =>
  span(
    {
      ...(defaultStyle ? { class: "text-gray" } : {}),
      title: formatDateTime(date),
    },
    formatRelativeTime(new Date(date))
  );

export const relativeDateOfAction: View<{ date: Date; action: string }> = ({
  date,
  action,
}) =>
  span(
    { class: "text-gray" },
    action,
    ": ",
    relativeDate({ date, defaultStyle: false })
  );
