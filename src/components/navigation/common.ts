import { fork } from "linki";

import {
  a,
  dangerousHTML,
  details,
  div,
  JsonHtml,
  li,
  span,
  summary,
  ul,
  View,
} from "../../libs/simple-ui/render";
import { preventDefault } from "../../libs/simple-ui/utils/funtions";

const loadingIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class=" v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <title>Loading your profile</title>
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"></path>
   <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path>
</svg>`;

export const loading: View = () =>
  span({ class: "btn-octicon" }, dangerousHTML(loadingIcon));

export const dropdownMenu: View<
  | { icon: string; children: JsonHtml[] }
  | { title: string; children: JsonHtml[] }
> = (props) =>
  details(
    { class: "dropdown details-reset details-overlay" },
    summary(
      {
        class: "btn-octicon",
        role: "button",
      },
      (props as { icon: string }).icon
        ? dangerousHTML((props as { icon: string }).icon)
        : (props as { title: string }).title,
      div({ class: "dropdown-caret" })
    ),
    ul(
      { class: "dropdown-menu dropdown-menu-sw right-0 width-auto" },
      ...props.children
    )
  );

export const dropdownItem: View<{ text: string; onClick: () => void }> = ({
  text,
  onClick,
}) =>
  li(
    a(
      {
        class: "dropdown-item",
        href: "#",
        onClick: fork(onClick, preventDefault),
      },
      text
    )
  );
