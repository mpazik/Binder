import { DirectoryIndex } from "../../functions/indexes/directory-index";
import { WatchHistorySearch } from "../../functions/indexes/watch-history-index";
import {
  createRecentDocumentSearch,
  RecentDocuments,
} from "../../functions/recent-document-serach";
import { a, Component, small, View } from "../../libs/simple-ui/render";
import { relativeDate } from "../common/relative-date";

const view: View<{ docs: RecentDocuments[] }> = ({ docs }) => [
  "nav",
  { class: "menu" },
  ...docs.map((it) =>
    a(
      { class: "menu-item", href: it.uriWithFragment.uri },
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
    searchRecentDocuments(undefined).then((docs) => render(view({ docs })));
  };
};
