import { gdrive, GDriveState } from "../../functions/gdrive/controller";
import { map } from "../../libs/connections";
import { newStateMapper } from "../../libs/named-state";
import {
  a,
  Component,
  dangerousInnerHtml,
  details,
  div,
  li,
  summary,
  ul,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { loading } from "../common/async-loader";

const logo = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="22"
    viewBox="0 0 1443.061 1249.993"
  >
    <path
      fill="#3777e3"
      d="M240.525 1249.993l240.492-416.664h962.044l-240.514 416.664z"
    />
    <path fill="#ffcf63" d="M962.055 833.329h481.006L962.055 0H481.017z" />
    <path
      fill="#11a861"
      d="M0 833.329l240.525 416.664 481.006-833.328L481.017 0z"
    />
  </svg>
`;

const moreIcon = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 16 16"
  width="16"
  height="16"
>
  <path d="M8 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM1.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
</svg>`;

export const profileView: ViewSetup<
  {
    login: () => void;
    logout: () => void;
  },
  GDriveState
> = ({ login, logout }) =>
  newStateMapper({
    initializing: () => loading(),
    loggingOut: () => loading(),
    loggingIn: () => loading(),
    profileRetrieving: () => loading(),
    ready: () =>
      div(
        { class: "p-2" },
        a({ type: "button", onClick: login }, "Sign In"),
        " to your cloud storage provider to synchronize your data"
      ),
    logged: (profile) =>
      div(
        { class: "d-flex", style: { width: "100%" } },
        div({ class: "p-2" }, dangerousInnerHtml(logo)),
        div(
          { class: "flex-auto d-flex flex-column" },
          div(profile.user.displayName),
          div({ class: " text-small text-gray" }, profile.user.emailAddress),
          details(
            { class: "dropdown details-reset details-overlay" },
            summary(
              { class: "btn-octicon", role: "button" },
              dangerousInnerHtml(moreIcon)
            ),
            ul(
              { class: "dropdown-menu dropdown-menu-sw right-0" },
              li(a({ class: "dropdown-item", onClick: logout }, "Logout"))
            )
          )
        )
      ),
  });

export const profilePanel: Component = () => (render) => {
  const renderView = profileView({
    logout: () => setAction(["logout"]),
    login: () => setAction(["login"]),
  });
  const setAction = gdrive(map(renderView)(render));
};
