import { Close, defined, filter, link, map, not, withState } from "linki";

import { DISPLAY_CONFIG_ENABLED } from "../../config";
import { GDriveLoadingProfile } from "../../functions/gdrive/app-files";
import { GDriveAction } from "../../functions/gdrive/controller";
import { DirectoryIndex } from "../../functions/indexes/directory-index";
import { WatchHistorySearch } from "../../functions/indexes/watch-history-index";
import { createRecentDocumentSearch } from "../../functions/recent-document-serach";
import { UriWithFragment } from "../../functions/url-hijack";
import { Callback, fork } from "../../libs/connections";
import {
  button,
  Component,
  dangerousHTML,
  details,
  div,
  fragment,
  JsonHtml,
  Listener,
  newSlot,
  slot,
  summary,
  View,
} from "../../libs/simple-ui/render";
import { getTarget } from "../../libs/simple-ui/utils/funtions";
import { productLogoBeta } from "../logo";

import { dropdownItem, dropdownMenu } from "./common";
import { profilePanel, ProfilePanelControl } from "./profile";
import { searchBox } from "./search-box";

const typographyIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="octicon v-align-middle" viewBox="0 0 24 24" width="24" height="24">
  <path fill-rule="evenodd" d="M10.414 15l1.63 4.505a.75.75 0 001.411-.51l-5.08-14.03a1.463 1.463 0 00-2.75 0l-5.08 14.03a.75.75 0 101.41.51L3.586 15h6.828zm-.544-1.5L7 5.572 4.13 13.5h5.74zm5.076-3.598c.913-1.683 2.703-2.205 4.284-2.205 1.047 0 2.084.312 2.878.885.801.577 1.392 1.455 1.392 2.548v8.12a.75.75 0 01-1.5 0v-.06a3.123 3.123 0 01-.044.025c-.893.52-2.096.785-3.451.785-1.051 0-2.048-.315-2.795-.948-.76-.643-1.217-1.578-1.217-2.702 0-.919.349-1.861 1.168-2.563.81-.694 2-1.087 3.569-1.087H22v-1.57c0-.503-.263-.967-.769-1.332-.513-.37-1.235-.6-2.001-.6-1.319 0-2.429.43-2.966 1.42a.75.75 0 01-1.318-.716zM22 14.2h-2.77c-1.331 0-2.134.333-2.593.726a1.82 1.82 0 00-.644 1.424c0 .689.267 1.203.686 1.557.43.365 1.065.593 1.826.593 1.183 0 2.102-.235 2.697-.581.582-.34.798-.74.798-1.134V14.2z"></path>
</svg>`;

const helpIcon = `
<svg xmlns="http://www.w3.org/2000/svg" class="v-align-middle" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
   <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
   <circle cx="12" cy="12" r="9"></circle>
   <line x1="12" y1="17" x2="12" y2="17.01"></line>
   <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4"></path>
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

const moveElementOnTopOfTheScreen = (
  element: HTMLElement,
  screenTopPosition: number = window.pageYOffset
) => {
  element.style.position = "absolute";
  element.style.top = `${
    screenTopPosition - element.getBoundingClientRect().height
  }px`;
};

const moveElementOnTopOfTheScreen2 = (
  element: HTMLElement,
  screenTopPosition: number = window.pageYOffset
) => {
  element.style.position = "absolute";
  element.style.top = `${Math.max(
    screenTopPosition - element.getBoundingClientRect().height,
    0
  )}px`;
};

const registerNavScrollListener = (nav: HTMLElement): Close => {
  let lastPosition = window.pageYOffset;
  let directionWasUp = false;

  const onScroll = () => {
    const newPosition = window.pageYOffset;
    const goingUp = newPosition < lastPosition;
    if (goingUp) {
      if (directionWasUp) {
        // continue going up
        if (nav.style.position === "absolute") {
          if (nav.getBoundingClientRect().top > 0) {
            // navigation fully uncovered
            nav.style.top = `0px`;
            nav.style.position = "fixed";
          }
        }
      } else {
        // switched direction to go up
        directionWasUp = true;
        if (
          // navigation not on the screen
          nav.getBoundingClientRect().bottom < 0 ||
          // or in the middle of the screen due to scroll jump
          nav.getBoundingClientRect().top > 0
        ) {
          // move navigation to on the top of the screen
          moveElementOnTopOfTheScreen(nav, newPosition);
        }
      }
    } else {
      if (directionWasUp) {
        // switched direction to go down
        directionWasUp = false;
        if (nav.style.position === "fixed") {
          // unpin nav
          nav.style.top = `${newPosition}px`;
          nav.style.position = "absolute";
        }
      }
    }
    lastPosition = newPosition;
  };

  document.addEventListener("scroll", onScroll);
  return () => document.removeEventListener("scroll", onScroll);
};

export const navigationView: View<{
  onDisplay?: Listener<"display">;
  body: JsonHtml;
  position?: string;
}> = ({ onDisplay, body, position = "absolute" }) =>
  div(
    {
      id: "navigation",
      class: "d-flex flex-justify-between flex-items-center width-full",
      style: {
        top: "0px",
        position,
        "z-index": 1,
      },
      onDisplay,
    },
    body
  );

export const navigation: Component<
  {
    updateGdrive: Callback<GDriveAction>;
    upload: () => void;
    loadUri: Callback<UriWithFragment>;
    searchDirectory: DirectoryIndex["search"];
    searchWatchHistory: WatchHistorySearch;
    initProfile: GDriveLoadingProfile;
  },
  ProfilePanelControl & { hideNav: void; setCurrentUri: string }
> = ({
  updateGdrive,
  upload,
  loadUri,
  searchDirectory,
  searchWatchHistory,
  initProfile,
}) => (render, onClose) => {
  const [profilePanelSlot, { updateStoreState, updateGdriveState }] = newSlot(
    "profile",
    profilePanel({
      login: () => updateGdrive(["login"]),
      logout: () => updateGdrive(["logout"]),
      upload,
    })
  );
  const searchRecentDocuments = createRecentDocumentSearch(
    searchDirectory,
    searchWatchHistory
  );

  let currentUri: string | undefined = undefined;
  const search = (terms: string | undefined) => {
    return searchRecentDocuments(terms).then((results) =>
      results.filter(not((it) => it.uriWithFragment.uri === currentUri))
    );
  };

  const searchBoxSlot = slot(
    "search-box",
    searchBox({
      onSelected: loadUri,
      onSearch: search,
    })
  );

  const [hideNav, setNavContext] = link(
    withState<HTMLElement | undefined>(undefined),
    filter(defined),
    moveElementOnTopOfTheScreen2
  );

  render(
    navigationView({
      onDisplay: fork(
        link(
          map(getTarget),
          fork(
            (e) => onClose(registerNavScrollListener(e)),
            (e) => setNavContext(e)
          )
        ),
        () => updateGdrive(["load", initProfile])
      ),
      body: fragment(
        div({ class: "flex-1 my-2" }, productLogoBeta),
        div(
          { class: "flex-auto mx-auto my-2", style: { maxWidth: "500px" } },
          searchBoxSlot
        ),
        div(
          { class: "flex-1 d-flex flex-sm-row-reverse" },
          div(
            { class: "d-flex" },
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
              : []),
            dropdownMenu({
              icon: helpIcon,
              children: [
                dropdownItem({
                  text: "Report bug",
                  href:
                    "https://github.com/mpazik/docland/issues?q=is%3Aissue+is%3Aopen+label%3Abug",
                }),
                dropdownItem({
                  text: "Request feature",
                  href:
                    "https://github.com/mpazik/docland/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement",
                }),
                dropdownItem({
                  text: "Join online chat",
                  href:
                    "https://discord.com/channels/876828347492073543/876831428753625129",
                }),
                dropdownItem({
                  text: "Email our team",
                  href: "mailto:hello@docland.app",
                }),
              ],
            }),
            profilePanelSlot
          )
        )
      ),
    })
  );

  return {
    updateStoreState,
    updateGdriveState,
    hideNav,
    setCurrentUri: (uri) => {
      currentUri = uri;
    },
  };
};
