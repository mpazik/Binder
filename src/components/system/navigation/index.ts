import type { ClosableProvider } from "linki";
import { fork, link, map, not, passOnlyChanged } from "linki";
import type { JsonHtml, UiComponent } from "linki-ui";
import { dom, mountComponent, renderJsonHtmlToDom } from "linki-ui";

import { DISPLAY_CONFIG_ENABLED } from "../../../config";
import type { GDriveLoadingProfile } from "../../../functions/gdrive/app-files";
import type { GDriveAction } from "../../../functions/gdrive/controller";
import type { DirectoryIndex } from "../../../functions/indexes/directory-index";
import type { WatchHistorySearch } from "../../../functions/indexes/watch-history-index";
import { createRecentDocumentSearch } from "../../../functions/recent-document-serach";
import { updateBrowserUri } from "../../../libs/browser-providers";

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

const elementSizeObserver = (
  element: HTMLElement
): ClosableProvider<ResizeObserverEntry[]> => (callback) => {
  const observer = new ResizeObserver(callback);
  observer.observe(element);
  return () => observer.disconnect();
};

export const navigation = ({
  displayed,
  searchDirectory,
  searchWatchHistory,
  displaySettingsSlot,
  initProfile,
}: {
  searchDirectory: DirectoryIndex["search"];
  searchWatchHistory: WatchHistorySearch;
  initProfile: GDriveLoadingProfile;
  displaySettingsSlot: JsonHtml;
  displayed: boolean;
}): UiComponent<
  ProfilePanelControl & {
    hideNav: void;
    showNav: void;
    hideNavPermanently: void;
    setCurrentUri: string;
    start: void;
    stop: void;
  },
  {
    upload: void;
    displayAccountPicker: void;
    updateGdrive: GDriveAction;
  }
> => ({ render, upload, displayAccountPicker, updateGdrive }) => {
  const [
    profilePanelSlot,
    { updateStoreState, updateGdriveState },
  ] = mountComponent(profilePanel, {
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
  ] = mountComponent(searchBox(search), {
    onSelected: updateBrowserUri,
  });

  const navElement = renderJsonHtmlToDom(
    navigationView({
      displayed,
      body: appNavContent({
        profilePanelSlot: profilePanelSlot,
        searchBoxSlot: searchBoxSlot,
        displaySettingsSlot,
        displayConfig: DISPLAY_CONFIG_ENABLED,
      }),
    })
  ) as HTMLElement;

  const onScroll = createOnScrollHandler(navElement);

  // dummy element that have same height as the nav so the content is pushed bellow the navigation
  const heightAdjuster = document.createElement("div");
  const closeNavHeightListener = link(
    elementSizeObserver(navElement),
    map((entries) => entries[0].contentRect.height),
    passOnlyChanged(),
    (height) => {
      heightAdjuster.style.height = `${height}px`;
    }
  );

  render([dom(heightAdjuster), dom(navElement)]);

  return {
    updateStoreState,
    updateGdriveState,
    hideNav: () => moveElementOnTopOfTheScreen(navElement),
    showNav: () => showElement(navElement),
    hideNavPermanently: () => hideElement(navElement),
    setCurrentUri: (uri) => {
      currentUri = uri;
    },
    start: fork(
      () => {
        updateGdrive(["load", initProfile]);
      },
      () => document.addEventListener("scroll", onScroll),
      startSearchBox
    ),
    stop: fork(
      () => {
        document.removeEventListener("scroll", onScroll);
      },
      stopSearchBox,
      closeNavHeightListener
    ),
  };
};
