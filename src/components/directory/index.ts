import { DirectoryIndex } from "../../functions/indexes/directory-index";
import { WatchHistorySearch } from "../../functions/indexes/watch-history-index";
import {
  createRecentDocumentSearch,
  RecentDocuments,
} from "../../functions/recent-document-serach";
import { UriWithFragment } from "../../functions/url-hijack";
import { Callback } from "../../libs/connections";
import { a, Component, small, View } from "../../libs/simple-ui/render";
import { relativeDate } from "../common/relative-date";

const view: View<{
  docs: RecentDocuments[];
  loadUri: Callback<UriWithFragment>;
}> = ({ docs, loadUri }) => [
  "nav",
  { class: "menu" },
  ...docs.map((it) =>
    a(
      { class: "menu-item", onClick: () => loadUri(it.uriWithFragment) },
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
  loadUri: Callback<UriWithFragment>;
}> = ({ searchDirectory, searchWatchHistory, loadUri }) => {
  const searchRecentDocuments = createRecentDocumentSearch(
    searchDirectory,
    searchWatchHistory
  );

  return (render) => {
    searchRecentDocuments(undefined).then((docs) =>
      render(view({ loadUri, docs }))
    );
  };
};
