import { GDriveProfile } from "../../functions/gdrive/app-files";
import { GDriveState } from "../../functions/gdrive/controller";
import { StoreState } from "../../functions/store";
import { combine } from "../../libs/connections";
import { definedTuple, filter } from "../../libs/connections/filters";
import { map } from "../../libs/connections/mappers";
import { newStateMapper } from "../../libs/named-state";
import {
  a,
  button,
  Component,
  dangerousHTML,
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

const errorIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" fill="var(--color-icon-danger)" viewBox="0 0 24 24" width="24" height="24">
  <title>Error :(</title>
  <path d="M12 7a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0112 7zm0 10a1 1 0 100-2 1 1 0 000 2z"></path>
  <path fill-rule="evenodd" d="M7.328 1.47a.75.75 0 01.53-.22h8.284a.75.75 0 01.53.22l5.858 5.858c.141.14.22.33.22.53v8.284a.75.75 0 01-.22.53l-5.858 5.858a.75.75 0 01-.53.22H7.858a.75.75 0 01-.53-.22L1.47 16.672a.75.75 0 01-.22-.53V7.858a.75.75 0 01.22-.53L7.328 1.47zm.84 1.28L2.75 8.169v7.662l5.419 5.419h7.662l5.419-5.418V8.168L15.832 2.75H8.168z"></path>
</svg>`;

const accountIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <circle cx="12" cy="7" r="4"></circle>
   <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path>
</svg>`;

const cloudOffIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <title>Logged out, can not synchronise data</title>
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <line x1="3" y1="3" x2="21" y2="21"></line>
   <path d="M18 18h-11c-2.598 0 -4.705 -2.015 -4.705 -4.5s2.107 -4.5 4.705 -4.5c.112 -.5 .305 -.973 .568 -1.408m2.094 -1.948c.329 -.174 .68 -.319 1.05 -.43c1.9 -.576 3.997 -.194 5.5 1c1.503 1.192 2.185 3.017 1.788 4.786h1a3.5 3.5 0 0 1 2.212 6.212"></path>
</svg>`;

const cloudDownloadIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <title>Downloading data from your account</title>
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <path d="M19 18a3.5 3.5 0 0 0 0 -7h-1a5 4.5 0 0 0 -11 -2a4.6 4.4 0 0 0 -2.1 8.4"></path>
   <line x1="12" y1="13" x2="12" y2="22"></line>
   <polyline points="9 19 12 22 15 19"></polyline>
</svg>`;

const cloudUploadIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <title>Uploading data to your account</title>
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1"></path>
   <polyline points="9 15 12 12 15 15"></polyline>
   <line x1="12" y1="12" x2="12" y2="21"></line>
</svg>`;

const uploadIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <title>Upload data to your account</title>
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"></path>
   <polyline points="7 9 12 4 17 9"></polyline>
   <line x1="12" y1="4" x2="12" y2="16"></line>
</svg>`;

type ProfileState =
  | GDriveState
  | ["uploading", GDriveProfile]
  | ["upload-needed", GDriveProfile]
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
  { login: () => void; logout: () => void; upload: () => void },
  ProfileState
> = ({ login, logout, upload }) =>
  newStateMapper<ProfileState, JsonHtml>({
    idle: () => loading(),
    loading: () => loading(),
    loggingOut: () => loading(),
    loggingIn: () => loading(),
    profileRetrieving: () => loading(),
    signedOut: () =>
      dropdownMenu({
        icon: cloudOffIcon,
        children: [
          li(
            { class: "px-4 py-2", style: { width: "200px" } },
            a(
              { type: "button", onClick: login, style: { cursor: "pointer" } },
              "Sign In"
            ),
            " to your cloud storage provider to synchronize your data"
          ),
        ],
      }),
    disconnected: () =>
      dropdownMenu({
        icon: cloudOffIcon,
        children: [
          li(
            { class: "px-4 py-2", style: { width: "200px" } },
            a(
              { type: "button", onClick: login, style: { cursor: "pointer" } },
              "Sign In"
            ),
            " you cloud storage session expired, please login it again"
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
    "upload-needed": () =>
      button(
        { class: "btn-octicon", onClick: upload },
        dangerousHTML(uploadIcon)
      ),
    uploading: (profile) =>
      dropdownMenu({
        icon: cloudUploadIcon,
        children: [
          profileStatusItem("uploading"),
          profileItem(profile),
          dropdownItem({ onClick: () => {}, text: "Storage settings" }),
          dropdownItem({ onClick: logout, text: "Logout" }),
        ],
      }),
    downloading: (profile) =>
      dropdownMenu({
        icon: cloudDownloadIcon,
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
  { login: () => void; logout: () => void; upload: () => void },
  ProfilePanelControl
> = (props) => (render) => {
  const renderProfileContainer = render;
  const renderProfile = map(createProfileView(props), renderProfileContainer);
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
            } else if (storeState[0] === "update-needed") {
              return ["upload-needed", profile] as ProfileState;
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
