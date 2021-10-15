import type { UriWithFragment } from "../../libs/browser-providers";
import type { DirectoryIndex } from "../indexes/directory-index";
import type { WatchHistorySearch } from "../indexes/watch-history-index";

import { recentDateComparator } from "./utils";

export type RecentDocuments = {
  name: string;
  uriWithFragment: UriWithFragment;
  startDate?: Date;
};

export const compareWatchHistoryItems = (
  a: RecentDocuments,
  b: RecentDocuments
): number => recentDateComparator(a.startDate, b.startDate);

export const createRecentDocumentSearch = (
  searchDirectory: DirectoryIndex["search"],
  searchWatchHistory: WatchHistorySearch
) => async (term: string | undefined): Promise<RecentDocuments[]> => {
  const getAll = term === "" || !term;
  const results = await searchDirectory(getAll ? {} : { name: term });
  const historyItems = await searchWatchHistory(
    getAll ? undefined : results.map((it) => it.hash)
  );
  const historyMap = new Map(
    historyItems.map((it) => {
      return [
        it.uri,
        {
          uriWithFragment: {
            uri: it.uri,
            fragment: it.fragment,
          },
          startTime: it.startTime,
        },
      ];
    })
  );

  return results
    .map(({ props: { name }, hash }) => {
      const historyItem = historyMap.get(hash);
      return {
        name,
        uriWithFragment: historyItem?.uriWithFragment ?? { uri: hash },
        startDate: historyItem?.startTime
          ? new Date(historyItem.startTime)
          : undefined,
      };
    })
    .sort(compareWatchHistoryItems);
};
