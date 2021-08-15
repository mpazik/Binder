import { DirectoryIndex } from "../../functions/indexes/directory-index";
import { WatchHistorySearch } from "../../functions/indexes/watch-history-index";
import {
  createRecentDocumentSearch,
  RecentDocuments,
} from "../../functions/recent-document-serach";
import { combineToUri } from "../../functions/url-hijack";
import {
  a,
  Component,
  div,
  h4,
  nav,
  p,
  small,
  View,
} from "../../libs/simple-ui/render";
import { relativeDate } from "../common/relative-date";

const view: View<{
  docs: RecentDocuments[];
}> = ({ docs }) =>
  div(
    h4("Your documents"),
    nav(
      { class: "menu" },
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
        "To open a wep article, paste its url address to the search bar on the top of the page. " +
          "You can open your favorite blogpost, wikipedia article or news page"
      ),
      p(
        "To open a document or ebook in PDF or EBUP format just drop the file  into the window."
      ),
      div(a({ href: "/about" }, "learn more"))
    )
  );

export const docsDirectory: Component<{
  searchDirectory: DirectoryIndex["search"];
  searchWatchHistory: WatchHistorySearch;
}> = ({ searchDirectory, searchWatchHistory }) => {
  const searchRecentDocuments = createRecentDocumentSearch(
    searchDirectory,
    searchWatchHistory
  );

  return (render) => {
    const renderStuff = async () => {
      const docs = await searchRecentDocuments(undefined);
      render(view({ docs }));
    };
    renderStuff();
  };
};
