import { GDriveProfile } from "../../functions/gdrive/app-files";
import { gdrive, GDriveState } from "../../functions/gdrive/controller";
import { StoreState } from "../../functions/store";
import { Consumer, fork, merge, Provider } from "../../libs/connections";
import { map } from "../../libs/connections/processors2";
import { newStateMapper } from "../../libs/named-state";
import {
  a,
  Component,
  details,
  div,
  JsonHtml,
  li,
  summary,
  ul,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { loading } from "../common/async-loader";

const gdriveLogoIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="25" height="22" viewBox="0 0 1443.061 1249.993" role="img">
  <title>Google Drive</title>
  <path fill="#3777e3" d="M240.525 1249.993l240.492-416.664h962.044l-240.514 416.664z"/>
  <path fill="#ffcf63" d="M962.055 833.329h481.006L962.055 0H481.017z" />
  <path fill="#11a861" d="M0 833.329l240.525 416.664 481.006-833.328L481.017 0z"/>
</svg>
`;

const moreIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <path d="M8 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM1.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
</svg>`;

const uploadIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" role="img">
  <title>uploading...</title>
  <path d="M4.97 12.97a.75.75 0 101.06 1.06L11 9.06v12.19a.75.75 0 001.5 0V9.06l4.97 4.97a.75.75 0 101.06-1.06l-6.25-6.25a.75.75 0 00-1.06 0l-6.25 6.25zM4.75 3.5a.75.75 0 010-1.5h14.5a.75.75 0 010 1.5H4.75z"/>
</svg>`;

const downloadIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" role="img">
  <title>downloading...</title>
  <path d="M4.97 11.03a.75.75 0 111.06-1.06L11 14.94V2.75a.75.75 0 011.5 0v12.19l4.97-4.97a.75.75 0 111.06 1.06l-6.25 6.25a.75.75 0 01-1.06 0l-6.25-6.25zm-.22 9.47a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H4.75z"/>
</svg>`;

const errorIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <title>Error :(</title>
  <path d="M12 7a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0112 7zm0 10a1 1 0 100-2 1 1 0 000 2z"></path><path fill-rule="evenodd" d="M7.328 1.47a.75.75 0 01.53-.22h8.284a.75.75 0 01.53.22l5.858 5.858c.141.14.22.33.22.53v8.284a.75.75 0 01-.22.53l-5.858 5.858a.75.75 0 01-.53.22H7.858a.75.75 0 01-.53-.22L1.47 16.672a.75.75 0 01-.22-.53V7.858a.75.75 0 01.22-.53L7.328 1.47zm.84 1.28L2.75 8.169v7.662l5.419 5.419h7.662l5.419-5.418V8.168L15.832 2.75H8.168z"></path>
</svg>`;

type ProfileState =
  | GDriveState
  | ["uploading", GDriveProfile]
  | ["downloading", GDriveProfile]
  | ["error", string];

export const profileView: ViewSetup<
  {
    login: () => void;
    logout: () => void;
  },
  ProfileState
> = ({ login, logout }) =>
  newStateMapper({
    idle: () => loading(),
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
        div({ class: "p-2", dangerouslySetInnerHTML: gdriveLogoIcon }),
        div(
          { class: "flex-auto d-flex flex-column" },
          div(profile.user.displayName),
          div({ class: " text-small text-gray" }, profile.user.emailAddress)
        ),
        details(
          { class: "dropdown details-reset details-overlay" },
          summary({
            class: "btn-octicon",
            role: "button",
            dangerouslySetInnerHTML: moreIcon,
          }),
          ul(
            { class: "dropdown-menu dropdown-menu-sw right-0" },
            li(a({ class: "dropdown-item", onClick: logout }, "Logout"))
          )
        )
      ),
    uploading: (profile) =>
      div(
        { class: "d-flex", style: { width: "100%" } },
        div({ class: "p-2", dangerouslySetInnerHTML: uploadIcon }),
        div(
          { class: "flex-auto d-flex flex-column" },
          div(profile.user.displayName),
          div({ class: " text-small text-gray" }, profile.user.emailAddress)
        )
      ),
    downloading: (profile) =>
      div(
        { class: "d-flex", style: { width: "100%" } },
        div({ class: "p-2", dangerouslySetInnerHTML: downloadIcon }),
        div(
          { class: "flex-auto d-flex flex-column" },
          div(profile.user.displayName),
          div({ class: " text-small text-gray" }, profile.user.emailAddress)
        )
      ),
    error: (reason) =>
      div(
        { class: "d-flex", style: { width: "100%" } },
        div({
          class: "p-2",
          style: { fill: "#d73a49" },
          dangerouslySetInnerHTML: errorIcon,
        }),
        div({ class: "flex-auto d-flex flex-column" }, reason)
      ),
  });

const profileContainer = (viewDom: JsonHtml) =>
  div(
    {
      class: "d-flex flex-wrap flex-content-around",
      style: { height: "64px" },
    },
    viewDom
  );

export const profilePanel: Component<{
  gdriveStateConsumer: Consumer<GDriveState>;
  storeStateProvider: Provider<StoreState>;
}> = ({ gdriveStateConsumer, storeStateProvider }) => (render, onClose) => {
  const renderInContainer = (view: JsonHtml) => render(profileContainer(view));

  const [gdriveStateForProfile, storeStateForProfile] = merge<
    GDriveState,
    StoreState,
    ProfileState
  >((gdriveState, storeState) => {
    if (gdriveState[0] === "logged") {
      const profile = gdriveState[1];
      if (storeState[0] === "uploading") {
        return ["uploading", profile];
      } else if (storeState[0] === "downloading") {
        return ["downloading", profile];
      } else if (storeState[0] === "error") {
        return ["error", storeState[1].error.message];
      }
    } else if (gdriveState[0] === "error") {
      return ["error", gdriveState[1]];
    }
    return gdriveState;
  })(
    map(
      profileView({
        logout: () => setAction(["logout"]),
        login: () => setAction(["login"]),
      }),
      renderInContainer
    )
  );

  const setAction = gdrive(fork(gdriveStateForProfile, gdriveStateConsumer));
  storeStateProvider(onClose, storeStateForProfile);
  renderInContainer(div());
};
