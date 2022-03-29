import { asyncMap, kick, link, map, withErrorLogging, wrap } from "linki";
import type { UiComponent, View } from "linki-ui";
import { a, div, h3, nav, p, small } from "linki-ui";

import type { DirectoryIndex } from "../../functions/indexes/directory-index";
import type { WatchHistorySearch } from "../../functions/indexes/watch-history-index";
import type { RecentDocuments } from "../../functions/recent-document-serach";
import { createRecentDocumentSearch } from "../../functions/recent-document-serach";
import { combineToUri } from "../../libs/browser-providers";
import { loading } from "../common/async-loader";
import { relativeDate } from "../common/relative-date";

const view: View<{
  docs: RecentDocuments[];
}> = ({ docs }) =>
  div(
    { class: "with-line-length-settings my-10" },
    h3("Your documents"),
    nav(
      { class: "menu my-3" },
      ...docs.map((it) =>
        a(
          { class: "menu-item", href: combineToUri(it.uriWithFragment) },
          it.name,
          ...(it.startDate
            ? [
                small(
                  { class: "float-right" },
                  relativeDate({ date: it.startDate })
                ),
              ]
            : [])
        )
      )
    ),
    div(
      { class: "Box p-2 mb-4, p-3" },
      p(
        "Paste url of your favorite blogpost, wikipedia article or news page to the search bar on the top of the page, or drop a PDF or EBUP file into the window."
      ),
      p(a({ href: "/about" }, "learn more"))
    )
  );

export const docsDirectory = ({
  searchDirectory,
  searchWatchHistory,
}: {
  searchDirectory: DirectoryIndex["search"];
  searchWatchHistory: WatchHistorySearch;
}): UiComponent => {
  const searchRecentDocuments = createRecentDocumentSearch(
    searchDirectory,
    searchWatchHistory
  );

  return ({ render }) => {
    render(loading());
    link(
      kick(undefined),
      withErrorLogging(asyncMap(searchRecentDocuments)),
      map(wrap("docs"), view),
      render
    );
  };
};
