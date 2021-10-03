import { Close, defined, filter, link, map, not, withState } from "linki";

import { GDriveLoadingProfile } from "../../functions/gdrive/app-files";
import { GDriveAction } from "../../functions/gdrive/controller";
import { DirectoryIndex } from "../../functions/indexes/directory-index";
import { WatchHistorySearch } from "../../functions/indexes/watch-history-index";
import { createRecentDocumentSearch } from "../../functions/recent-document-serach";
import { UriWithFragment } from "../../functions/url-hijack";
import { Callback, fork } from "../../libs/connections";
import {
  Component,
  JsonHtml,
  newSlot,
  slot,
} from "../../libs/simple-ui/render";
import { getTarget } from "../../libs/simple-ui/utils/funtions";

import { profilePanel, ProfilePanelControl } from "./profile";
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
  element.style.setProperty("display", "none", "important");
};

const showElement = (element: HTMLElement) => {
  element.style.removeProperty("display");
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

export const navigation: Component<
  {
    updateGdrive: Callback<GDriveAction>;
    displayAccountPicker: Callback;
    upload: () => void;
    loadUri: Callback<UriWithFragment>;
    searchDirectory: DirectoryIndex["search"];
    searchWatchHistory: WatchHistorySearch;
    initProfile: GDriveLoadingProfile;
    displaySettingsSlot: JsonHtml;
  },
  ProfilePanelControl & {
    hideNav: void;
    showNav: void;
    hideNavPermanently: void;
    setCurrentUri: string;
  }
> = ({
  updateGdrive,
  displayAccountPicker,
  upload,
  loadUri,
  searchDirectory,
  searchWatchHistory,
  displaySettingsSlot,
  initProfile,
}) => (render, onClose) => {
  const [profilePanelSlot, { updateStoreState, updateGdriveState }] = newSlot(
    "profile",
    profilePanel({
      login: displayAccountPicker,
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
    moveElementOnTopOfTheScreen
  );

  const [hideNavPermanently, setNavContext2] = link(
    withState<HTMLElement | undefined>(undefined),
    filter(defined),
    hideElement
  );

  const [showNav, setNavContext3] = link(
    withState<HTMLElement | undefined>(undefined),
    filter(defined),
    showElement
  );

  render(
    navigationView({
      onDisplay: fork(
        link(
          map(getTarget),
          fork(
            (e) => onClose(registerNavScrollListener(e)),
            (e) => setNavContext(e),
            (e) => setNavContext2(e),
            (e) => setNavContext3(e)
          )
        ),
        () => updateGdrive(["load", initProfile])
      ),
      body: appNavContent({
        profilePanelSlot,
        searchBoxSlot,
        displaySettingsSlot,
      }),
    })
  );

  return {
    updateStoreState,
    updateGdriveState,
    hideNav,
    showNav,
    hideNavPermanently,
    setCurrentUri: (uri) => {
      currentUri = uri;
    },
  };
};
