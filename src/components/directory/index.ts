import { DirectoryIndex } from "../../functions/indexes/directory-index";
import { WatchHistorySearch } from "../../functions/indexes/watch-history-index";
import {
  createRecentDocumentSearch,
  RecentDocuments,
} from "../../functions/recent-document-serach";
import { combineToUri } from "../../functions/url-hijack";
import { a, Component, small, View } from "../../libs/simple-ui/render";
import { relativeDate } from "../common/relative-date";

const view: View<{
  docs: RecentDocuments[];
}> = ({ docs }) => [
  "nav",
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
  ),
];

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
