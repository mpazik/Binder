import type { Callback } from "linki";
import { fork, not } from "linki";
import type { JsonHtml } from "linki-ui";
import { renderJsonHtmlToDom, dom } from "linki-ui";

import type { GDriveLoadingProfile } from "../../functions/gdrive/app-files";
import type { GDriveAction } from "../../functions/gdrive/controller";
import type { DirectoryIndex } from "../../functions/indexes/directory-index";
import type { WatchHistorySearch } from "../../functions/indexes/watch-history-index";
import { createRecentDocumentSearch } from "../../functions/recent-document-serach";
import type { UriWithFragment } from "../../libs/browser-providers";
import type { ElementComponent } from "../../libs/simple-ui/new-renderer";

import type { ProfilePanelControl } from "./profile";
import { profilePanel } from "./profile";
import { searchBox } from "./search-box";
import { appNavContent, navigationView } from "./view";

export { navigationView } from "./view";

const moveElementOnTopOfTheScreen = (
  element: HTMLElement,
  screenTopPosition: number = window.pageYOffset
) => {
  element.style.position = "absolute";
  element.style.top = `${Math.max(
    screenTopPosition - element.getBoundingClientRect().height,
    0
  )}px`;
};

const hideElement = (element: HTMLElement) => {
  element.classList.remove("d-flex");
  element.classList.add("d-none");
};

const showElement = (element: HTMLElement) => {
  element.classList.add("d-flex");
  element.classList.remove("d-none");
};

const createOnScrollHandler = (nav: HTMLElement): (() => void) => {
  let lastPosition = window.pageYOffset;
  let directionWasUp = false;

  return () => {
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
};

export const navigationElement: ElementComponent<
  {
    displayed: boolean;
    body: JsonHtml;
  },
  {
    hideNav: void;
    showNav: void;
    hideNavPermanently: void;
    start: void;
    stop: void;
  }
> = ({ displayed, body }) => {
  const element = renderJsonHtmlToDom(
    navigationView({
      displayed,
      body,
    })
  ) as HTMLElement;

  const onScroll = createOnScrollHandler(element);
  return [
    element,
    {
      hideNav: () => moveElementOnTopOfTheScreen(element),
      showNav: () => showElement(element),
      hideNavPermanently: () => hideElement(element),
      start: () => {
        document.addEventListener("scroll", onScroll);
      },
      stop: () => {
        document.removeEventListener("scroll", onScroll);
      },
    },
  ];
};

export const navigation: ElementComponent<
  {
    updateGdrive: Callback<GDriveAction>;
    displayAccountPicker: Callback;
    upload: () => void;
    loadUri: Callback<UriWithFragment>;
    searchDirectory: DirectoryIndex["search"];
    searchWatchHistory: WatchHistorySearch;
    initProfile: GDriveLoadingProfile;
    displaySettingsSlot: JsonHtml;
    displayed: boolean;
  },
  ProfilePanelControl & {
    hideNav: void;
    showNav: void;
    hideNavPermanently: void;
    setCurrentUri: string;
    start: void;
    stop: void;
  }
> = ({
  updateGdrive,
  displayAccountPicker,
  upload,
  displayed,
  loadUri,
  searchDirectory,
  searchWatchHistory,
  displaySettingsSlot,
  initProfile,
}) => {
  const [
    profilePanelSlot,
    { updateStoreState, updateGdriveState },
  ] = profilePanel({
    login: displayAccountPicker,
    logout: () => updateGdrive(["logout"]),
    upload,
  });

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

  const [
    searchBoxSlot,
    { start: startSearchBox, stop: stopSearchBox },
  ] = searchBox({
    onSelected: loadUri,
    onSearch: search,
  });

  const [
    navElement,
    { hideNavPermanently, hideNav, showNav, stop: stopNav, start: startNav },
  ] = navigationElement({
    displayed,
    body: appNavContent({
      profilePanelSlot: dom(profilePanelSlot),
      searchBoxSlot: dom(searchBoxSlot),
      displaySettingsSlot,
    }),
  });

  return [
    navElement,
    {
      updateStoreState,
      updateGdriveState,
      hideNav,
      showNav,
      hideNavPermanently,
      setCurrentUri: (uri) => {
        currentUri = uri;
      },
      start: fork(
        () => {
          updateGdrive(["load", initProfile]);
        },
        startNav,
        startSearchBox
      ),
      stop: fork(stopNav, stopSearchBox),
    },
  ];
};
