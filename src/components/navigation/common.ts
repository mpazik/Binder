import { fork } from "linki";
import type { JsonHtml, View } from "linki-ui";
import {
  a,
  dangerousHtml,
  details,
  div,
  li,
  span,
  summary,
  ul,
} from "linki-ui";

import { preventDefault } from "../../libs/simple-ui/utils/funtions";
import { getLinkTarget } from "../common/link";

const loadingIcon = `<svg xmlns="http://www.w3.org/2000/svg" class=" v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <title>Loading your profile</title>
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"></path>
   <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path>
</svg>`;

export const loading: View = () =>
  span({ class: "btn-octicon" }, dangerousHtml(loadingIcon));

export const dropdown: View<
  { children: JsonHtml[] } & (
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
      div({ class: "dropdown-caret" })
    ),
    div(
      { class: "dropdown-menu dropdown-menu-sw right-0 width-auto" },
      ...props.children
    )
  );

export const dropdownMenu: View<
  { children: JsonHtml[]; open?: boolean } & (
    | { title: string }
    | { icon: string }
  )
> = (props) =>
  details(
    {
      class: "dropdown details-reset details-overlay",
      ...(props.open ? { open: undefined } : {}),
    },
    summary(
      {
        class: "btn-octicon",
      },
      (props as { icon: string }).icon
        ? dangerousHtml((props as { icon: string }).icon)
        : (props as { title: string }).title,
      div({ class: "dropdown-caret" })
    ),
    ul(
      { class: "dropdown-menu dropdown-menu-sw right-0 width-auto" },
      ...props.children
    )
  );

export const dropdownButton: View<{ text: string; onClick: () => void }> = (
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
