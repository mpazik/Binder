import { GDriveProfile } from "../../functions/gdrive/app-files";
import { gdrive, GDriveState } from "../../functions/gdrive/controller";
import { StoreState } from "../../functions/store";
import { Consumer, fork, merge, Provider } from "../../libs/connections";
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
import { map } from "../../libs/connections/processors2";

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

type ProfileState =
  | GDriveState
  | ["uploading", GDriveProfile]
  | ["downloading", GDriveProfile];
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
}> = ({ gdriveStateConsumer, storeStateProvider }) => (render) => {
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
      }
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
  storeStateProvider(storeStateForProfile);
  renderInContainer(div());
};
