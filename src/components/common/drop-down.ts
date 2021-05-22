import {
  a,
  details,
  div,
  li,
  summary,
  ul,
  View,
  ViewSetup,
} from "../../libs/simple-ui/render";

const moreIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <path d="M8 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM1.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
</svg>`;

type Action = {
  handler: () => void;
  label: string;
};
export const moreActions: View<{ actions: Action[] }> = ({ actions }) =>
  details(
    { class: "dropdown details-reset details-overlay" },
    summary({
      class: "btn-octicon",
      role: "button",
      dangerouslySetInnerHTML: moreIcon,
    }),
    ul(
      { class: "dropdown-menu dropdown-menu-sw right-0" },
      ...actions.map(({ label, handler }) =>
        li(
          a(
            {
              class: "dropdown-item",
              onClick: handler,
            },
            label
          )
        )
      )
    )
  );

export const createDropDown: ViewSetup<{ actions: Action[] }, void> = ({
  actions,
}) => () =>
  details(
    { class: "dropdown details-reset details-overlay" },
    summary(
      {
        class: "btn-octicon",
        role: "button",
      },
      div({ class: "dropdown-caret" })
    ),
    ul(
      { class: "dropdown-menu dropdown-menu-sw right-0" },
      ...actions.map(({ label, handler }) =>
        li(
          a(
            {
              class: "dropdown-item",
              onClick: handler,
            },
            label
          )
        )
      )
    )
  );
