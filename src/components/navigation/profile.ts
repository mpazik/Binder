import { GDriveProfile } from "../../functions/gdrive/app-files";
import { GDriveState } from "../../functions/gdrive/controller";
import { StoreState } from "../../functions/store";
import { combine } from "../../libs/connections";
import { definedTuple, filter } from "../../libs/connections/filters";
import { map } from "../../libs/connections/mappers";
import { newStateMapper } from "../../libs/named-state";
import {
  a,
  Component,
  div,
  JsonHtml,
  li,
  span,
  View,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { maxLengthText } from "../common/max-length-text";

import { dropdownItem, dropdownMenu, loading } from "./common";

const gdriveLogoIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="25" height="22" viewBox="0 0 1443.061 1249.993" role="img">
  <title>Google Drive</title>
  <path fill="#3777e3" d="M240.525 1249.993l240.492-416.664h962.044l-240.514 416.664z"/>
  <path fill="#ffcf63" d="M962.055 833.329h481.006L962.055 0H481.017z" />
  <path fill="#11a861" d="M0 833.329l240.525 416.664 481.006-833.328L481.017 0z"/>
</svg>
`;

const uploadIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle octicon" viewBox="0 0 24 24" width="24" height="24" role="img">
  <title>uploading...</title>
  <path d="M4.97 12.97a.75.75 0 101.06 1.06L11 9.06v12.19a.75.75 0 001.5 0V9.06l4.97 4.97a.75.75 0 101.06-1.06l-6.25-6.25a.75.75 0 00-1.06 0l-6.25 6.25zM4.75 3.5a.75.75 0 010-1.5h14.5a.75.75 0 010 1.5H4.75z"/>
</svg>`;

const downloadIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle octicon" viewBox="0 0 24 24" width="24" height="24" role="img">
  <title>downloading...</title>
  <path d="M4.97 11.03a.75.75 0 111.06-1.06L11 14.94V2.75a.75.75 0 011.5 0v12.19l4.97-4.97a.75.75 0 111.06 1.06l-6.25 6.25a.75.75 0 01-1.06 0l-6.25-6.25zm-.22 9.47a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H4.75z"/>
</svg>`;

const errorIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" fill="var(--color-icon-danger)" viewBox="0 0 24 24" width="24" height="24">
  <title>Error :(</title>
  <path d="M12 7a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0112 7zm0 10a1 1 0 100-2 1 1 0 000 2z"></path>
  <path fill-rule="evenodd" d="M7.328 1.47a.75.75 0 01.53-.22h8.284a.75.75 0 01.53.22l5.858 5.858c.141.14.22.33.22.53v8.284a.75.75 0 01-.22.53l-5.858 5.858a.75.75 0 01-.53.22H7.858a.75.75 0 01-.53-.22L1.47 16.672a.75.75 0 01-.22-.53V7.858a.75.75 0 01.22-.53L7.328 1.47zm.84 1.28L2.75 8.169v7.662l5.419 5.419h7.662l5.419-5.418V8.168L15.832 2.75H8.168z"></path>
</svg>`;

const accountIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle octicon" viewBox="0 0 24 24" width="24" height="24" >
    <path fill-rule="evenodd" d="M12 2.5a5.5 5.5 0 00-3.096 10.047 9.005 9.005 0 00-5.9 8.18.75.75 0 001.5.045 7.5 7.5 0 0114.993 0 .75.75 0 101.499-.044 9.005 9.005 0 00-5.9-8.181A5.5 5.5 0 0012 2.5zM8 8a4 4 0 118 0 4 4 0 01-8 0z"></path>
</svg>`;

type ProfileState =
  | GDriveState
  | ["uploading", GDriveProfile]
  | ["downloading", GDriveProfile]
  | ["error", string];

const profileItem: View<GDriveProfile> = ({ user }) =>
  li(
    {
      class: "d-flex p-2 px-4 border-bottom border-black-fade",
      style: { width: "100%" },
    },
    div({ class: "p-2", dangerouslySetInnerHTML: gdriveLogoIcon }),
    div(
      { class: "flex-auto d-flex flex-column" },
      div(user.displayName),
      div({ class: " text-small color-text-secondary" }, user.emailAddress)
    )
  );

const profileStatusItem: View<string> = (status: string) =>
  li(
    {
      class:
        "color-text-secondary text-center border-bottom border-black-fade text-light",
    },
    status,
    span({ class: "AnimatedEllipsis" })
  );

export const createProfileView: ViewSetup<
  { login: () => void; logout: () => void },
  ProfileState
> = ({ login, logout }) =>
  newStateMapper<ProfileState, JsonHtml>({
    idle: () => loading(),
    loading: () => loading(),
    loggingOut: () => loading(),
    loggingIn: () => loading(),
    profileRetrieving: () => loading(),
    ready: () =>
      dropdownMenu({
        title: "Sign in",
        children: [
          li(
            { class: "px-4 py-2", style: { width: "200px" } },
            a({ type: "button", onClick: login }, "Sign In"),
            " to your cloud storage provider to synchronize your data"
          ),
        ],
      }),
    logged: (profile) =>
      dropdownMenu({
        icon: accountIcon,
        children: [
          profileItem(profile),
          dropdownItem({ onClick: () => {}, text: "Storage settings" }),
          dropdownItem({ onClick: logout, text: "Logout" }),
        ],
      }),
    uploading: (profile) =>
      dropdownMenu({
        icon: uploadIcon,
        children: [
          profileStatusItem("uploading"),
          profileItem(profile),
          dropdownItem({ onClick: () => {}, text: "Storage settings" }),
          dropdownItem({ onClick: logout, text: "Logout" }),
        ],
      }),
    downloading: (profile) =>
      dropdownMenu({
        icon: downloadIcon,
        children: [
          profileStatusItem("downloading"),
          profileItem(profile),
          dropdownItem({ onClick: () => {}, text: "Storage settings" }),
          dropdownItem({ onClick: logout, text: "Logout" }),
        ],
      }),
    error: (reason) =>
      dropdownMenu({
        icon: errorIcon,
        children: [
          li(
            {
              class: "d-inline-flex flex-items-center p-2",
              style: { width: "200px" },
            },
            div({
              class: "p-2",
              style: { fill: "var(--color-icon-danger)" },
              dangerouslySetInnerHTML: errorIcon,
            }),
            div({ class: "d-flex" }, maxLengthText(reason, 50))
          ),
        ],
      }),
  });

export type ProfilePanelControl = {
  updateStoreState: StoreState;
  updateGdriveState: GDriveState;
};

export const profilePanel: Component<
  { login: () => void; logout: () => void },
  ProfilePanelControl
> = ({ logout, login }) => (render) => {
  const renderProfileContainer = render;
  const renderProfile = map(
    createProfileView({ logout, login }),
    renderProfileContainer
  );
  const [gdriveStateForProfile, storeStateForProfile] = combine<
    [GDriveState, StoreState]
  >(
    filter(
      definedTuple,
      map(([gdriveState, storeState]) => {
        const state: ProfileState = (() => {
          if (gdriveState[0] === "logged") {
            const profile = gdriveState[1];
            if (storeState[0] === "uploading") {
              return ["uploading", profile] as ProfileState;
            } else if (storeState[0] === "downloading") {
              return ["downloading", profile] as ProfileState;
            } else if (storeState[0] === "error") {
              return ["error", storeState[1].error.message] as ProfileState;
            }
          } else if (gdriveState[0] === "error") {
            return ["error", gdriveState[1]] as ProfileState;
          }
          return gdriveState as ProfileState;
        })();
        return state;
      }, renderProfile)
    ),
    undefined,
    undefined
  );
  renderProfileContainer(loading());

  return {
    updateStoreState: storeStateForProfile,
    updateGdriveState: gdriveStateForProfile,
  };
};
