import { fork } from "linki";
import type { JsonHtml, View } from "linki-ui";
import {
  a,
  dangerousHtml,
  details,
  div,
  li,
  preventDefault,
  summary,
} from "linki-ui";

import { getLinkTarget } from "./uri";

export const dropdown: View<
  { children: JsonHtml[]; hideDropDownCaret?: boolean } & (
    | { title: string }
    | { icon: string; title?: string }
  )
> = (props) =>
  details(
    { class: "dropdown details-reset details-overlay" },
    summary(
      {
        class: "btn-octicon",
        title: (props as { icon: string }).icon ? props.title : undefined,
      },
      (props as { icon: string }).icon
        ? dangerousHtml((props as { icon: string }).icon)
        : (props as { title: string }).title,
      props.hideDropDownCaret ? undefined : div({ class: "dropdown-caret" })
    ),
    div(
      { class: "dropdown-menu dropdown-menu-sw right-0 width-auto" },
      ...props.children
    )
  );

export const dropdownItem: View<{ text: string; onClick: () => void }> = (
  props
) =>
  li(
    a(
      {
        class: "dropdown-item",
        href: "#",
        onClick: fork(props.onClick, preventDefault),
      },
      props.text
    )
  );

export const dropdownLink: View<{ text: string; href: string }> = (props) =>
  li(
    a(
      {
        class: "dropdown-item",
        href: props.href,
        target: getLinkTarget(props.href),
      },
      props.text
    )
  );

const moreIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" viewBox="0 0 16 16" width="16" height="16">
  <path d="M8 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM1.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
</svg>`;

type Action = {
  handler: () => void;
  label: string;
};
export const moreActions: View<{ actions: Action[] }> = ({ actions }) =>
  dropdown({
    icon: moreIcon,
    hideDropDownCaret: true,
    children: actions.map((it) =>
      dropdownItem({ onClick: it.handler, text: it.label })
    ),
  });
