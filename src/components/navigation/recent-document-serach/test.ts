import {
  artOfChartDirRecord,
  createInMemorySearchDirectoryIndex,
  definitionDirRecord,
  directoryRecords,
  discOrgDirRecord,
  firetDirRecord,
  hydraDirRecord,
} from "../../../functions/indexes/directory-index/mock";
import {
  createInMemoryWatchHistorySearch,
  firetWatchRecord,
  hydraWatchRecord,
  watchRecords,
} from "../../../functions/indexes/watch-history-index/mock";

import { recentDateComparator } from "./utils";

import { createRecentDocumentSearch } from "./index";

describe("recentDateComparator", () => {
  const date1 = new Date("2021-07-31T07:00:00");
  const date2 = new Date("2021-07-31T07:10:00");

  it("should return old date last", () => {
    const sortedList = [date1, date2].sort(recentDateComparator);

    expect(sortedList).toEqual([date2, date1]);
  });

  it("should return undefined date last", () => {
    const sortedList = [date1, undefined, date2].sort(recentDateComparator);

    expect(sortedList).toEqual([date2, date1, undefined]);
  });

  it("later date is lower", () => {
    expect(recentDateComparator(date2, date1)).toEqual(-1);
  });

  it("earlier date is higher", () => {
    expect(recentDateComparator(date1, date2)).toEqual(1);
  });

  it("first undefined date is higher", () => {
    expect(recentDateComparator(undefined, date1)).toEqual(1);
  });

  it("first defined date is lower", () => {
    expect(recentDateComparator(date1, undefined)).toEqual(-1);
  });

  it("same dates should be equal", () => {
    expect(recentDateComparator(date1, new Date(date1.toISOString()))).toEqual(
      0
    );
  });

  it("undefined dates should be equal", () => {
    expect(recentDateComparator(undefined, undefined)).toEqual(0);
  });
});

describe("recentDocumentSearch", () => {
  it("something", async () => {
    const searchRecentDocuments = createRecentDocumentSearch(
      createInMemorySearchDirectoryIndex(directoryRecords),
      createInMemoryWatchHistorySearch(watchRecords)
    );

    const results = await searchRecentDocuments(undefined);

    expect(results).toEqual([
      {
        name: hydraDirRecord.props.name,
        uriWithFragment: {
          uri: hydraDirRecord.hash,
        },
        startDate: new Date(hydraWatchRecord.startTime),
      },
      {
        name: firetDirRecord.props.name,
        uriWithFragment: {
          uri: firetDirRecord.hash,
          fragment: firetWatchRecord.fragment,
        },
        startDate: new Date(firetWatchRecord.startTime),
      },
      {
        name: discOrgDirRecord.props.name,
        uriWithFragment: {
          uri: discOrgDirRecord.hash,
        },
      },
      {
        name: artOfChartDirRecord.props.name,
        uriWithFragment: {
          uri: artOfChartDirRecord.hash,
        },
      },
      {
        name: definitionDirRecord.props.name,
        uriWithFragment: {
          fragment: "content",
          uri: definitionDirRecord.hash,
        },
      },
    ]);
  });
});
