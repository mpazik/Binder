import { link, map } from "linki";

import { DISPLAY_CONFIG_ENABLED } from "../../config";
import { GDriveLoadingProfile } from "../../functions/gdrive/app-files";
import { GDriveAction } from "../../functions/gdrive/controller";
import { DirectoryIndex } from "../../functions/indexes/directory-index";
import {
  newUriWithFragment,
  updateBrowserHistory,
  UriWithFragment,
} from "../../functions/url-hijack";
import { Callback, fork } from "../../libs/connections";
import { throwIfNull } from "../../libs/errors";
import {
  button,
  Component,
  dangerousHTML,
  details,
  div,
  h2,
  newSlot,
  slot,
  span,
  summary,
} from "../../libs/simple-ui/render";

import { profilePanel, ProfilePanelControl } from "./profile";
import { searchBox } from "./search-box";

const typographyIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="octicon v-align-middle" viewBox="0 0 24 24" width="24" height="24">
  <path fill-rule="evenodd" d="M10.414 15l1.63 4.505a.75.75 0 001.411-.51l-5.08-14.03a1.463 1.463 0 00-2.75 0l-5.08 14.03a.75.75 0 101.41.51L3.586 15h6.828zm-.544-1.5L7 5.572 4.13 13.5h5.74zm5.076-3.598c.913-1.683 2.703-2.205 4.284-2.205 1.047 0 2.084.312 2.878.885.801.577 1.392 1.455 1.392 2.548v8.12a.75.75 0 01-1.5 0v-.06a3.123 3.123 0 01-.044.025c-.893.52-2.096.785-3.451.785-1.051 0-2.048-.315-2.795-.948-.76-.643-1.217-1.578-1.217-2.702 0-.919.349-1.861 1.168-2.563.81-.694 2-1.087 3.569-1.087H22v-1.57c0-.503-.263-.967-.769-1.332-.513-.37-1.235-.6-2.001-.6-1.319 0-2.429.43-2.966 1.42a.75.75 0 01-1.318-.716zM22 14.2h-2.77c-1.331 0-2.134.333-2.593.726a1.82 1.82 0 00-.644 1.424c0 .689.267 1.203.686 1.557.43.365 1.065.593 1.826.593 1.183 0 2.102-.235 2.697-.581.582-.34.798-.74.798-1.134V14.2z"></path>
</svg>`;

const navigationIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
  <line x1="4" y1="6" x2="20" y2="6"></line>
  <line x1="4" y1="12" x2="20" y2="12"></line>
  <line x1="4" y1="18" x2="20" y2="18"></line>
</svg>`;

const zoomIn = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
  <circle cx="10" cy="10" r="7"></circle>
  <line x1="7" y1="10" x2="13" y2="10"></line>
  <line x1="10" y1="7" x2="10" y2="13"></line>
  <line x1="21" y1="21" x2="15" y2="15"></line>
</svg>`;

const zoomOut = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
  <circle cx="10" cy="10" r="7"></circle>
  <line x1="7" y1="10" x2="13" y2="10"></line>
  <line x1="21" y1="21" x2="15" y2="15"></line>
</svg>`;

const binderLogo = `
<svg class="v-align-middle" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 64 64">
  <path xmlns="http://www.w3.org/2000/svg" d="M56 0H14C9.4 0 6 3.4 6 8v4H2c-1.1 0-2 .9-2 2s.9 2 2 2h4v32H2c-1.1 0-2 .9-2 2s.9 2 2 2h4v4c0 4.6 3.4 8 8 8h44c4.6 0 6-3.4 6-8V8c0-4.6-3.4-8-8-8zM10 56v-4h4c1.1 0 2-.9 2-2s-.9-2-2-2h-4V16h4c1.1 0 2-.9 2-2s-.9-2-2-2h-4V8c0-2.4 1.6-4 4-4h6v56h-6c-2.4 0-4-1.6-4-4zm50 0c0 2.3.302 3.323-2 4H24V4h32c2.3 0 4 1.6 4 4zm-8-44H32c-1.1 0-2 .9-2 2s.9 2 2 2h20c1.1 0 2-.9 2-2s-.9-2-2-2zm0 10H32c-1.1 0-2 .9-2 2s.9 2 2 2h20c1.1 0 2-.9 2-2s-.9-2-2-2z"/>
</svg>`;

export const navigation: Component<
  {
    updateGdrive: Callback<GDriveAction>;
    loadUri: Callback<UriWithFragment>;
    directoryIndex: DirectoryIndex["search"];
    initProfile: GDriveLoadingProfile;
  },
  ProfilePanelControl
> = ({ updateGdrive, loadUri, directoryIndex, initProfile }) => (render) => {
  const [profilePanelSlot, profilePanelControl] = newSlot(
    "profile",
    profilePanel({
      login: () => updateGdrive(["login"]),
      logout: () => updateGdrive(["logout"]),
    })
  );

  let nav: HTMLElement;
  let lastPosition = window.pageYOffset;
  let directionDown = true;
  document.addEventListener("scroll", () => {
    const newPosition = window.pageYOffset;
    if (newPosition > lastPosition) {
      if (!directionDown) {
        directionDown = true;
        const navChecked = throwIfNull(nav);
        if (navChecked.style.position === "fixed") {
          navChecked.style.top = `${newPosition}px`;
          navChecked.style.position = "absolute";
        }
      }
    } else {
      const navChecked = throwIfNull(nav);
      if (directionDown) {
        directionDown = false;
        if (navChecked.getBoundingClientRect().bottom < 0) {
          navChecked.style.top = `${
            newPosition - navChecked.getBoundingClientRect().height
          }px`;
        }
      } else if (navChecked.style.position === "absolute") {
        if (navChecked.getBoundingClientRect().top > 0) {
          navChecked.style.top = `0px`;
          navChecked.style.position = "fixed";
        }
      }
    }
    lastPosition = newPosition;
  });

  const searchBoxSlot = slot(
    "search-box",
    searchBox({
      onSelected: link(
        map(newUriWithFragment),
        fork(updateBrowserHistory, loadUri)
      ),
      onSearch: (name) => directoryIndex({ name }),
    })
  );

  render(
    div(
      {
        id: "navigation",
        class: "d-flex flex-justify-between flex-items-center width-full",
        style: {
          top: "0px",
          position: "absolute",
          "z-index": 1,
        },
        onDisplay: fork(
          (e) => (nav = e.target as HTMLElement),
          () => updateGdrive(["load", initProfile])
        ),
      },
      div(
        { class: "flex-1" },
        h2(
          { class: "ml-2", style: { "font-size": "22px" } },
          dangerousHTML(binderLogo),
          span({ class: "v-align-middle" }, " binder")
        )
      ),
      div(
        { class: "flex-auto" },
        div(
          { class: "mx-auto my-2", style: { maxWidth: "500px" } },
          searchBoxSlot
        )
      ),
      div(
        { class: "flex-1 d-flex" },
        div({ class: "flex-1" }),
        ...(DISPLAY_CONFIG_ENABLED
          ? [
              button({ class: "btn-octicon" }, dangerousHTML(zoomOut)),
              button({ class: "btn-octicon" }, dangerousHTML(zoomIn)),
              details(
                { class: "dropdown details-reset details-overlay" },
                summary(
                  {
                    class: "btn-octicon",
                    role: "button",
                  },
                  dangerousHTML(navigationIcon),
                  div({ class: "dropdown-caret" })
                ),
                div(
                  { class: "dropdown-menu dropdown-menu-sw right-0" },
                  "something"
                )
              ),
              details(
                { class: "dropdown details-reset details-overlay" },
                summary(
                  {
                    class: "btn-octicon",
                    role: "button",
                  },
                  dangerousHTML(typographyIcon),
                  div({ class: "dropdown-caret" })
                ),
                div(
                  { class: "dropdown-menu dropdown-menu-sw right-0" },
                  "something"
                )
              ),
            ]
          : [])
      ),
      profilePanelSlot
    )
  );

  return profilePanelControl;
};
