import { definitionDocHash, hydraDocHash } from "../directory-index/mock";

import {
  hydraWatchActionLd,
  definitionWatchActionWithoutDatesLd,
  hydraWatchRecord,
  definitionWatchRecordWithoutDates,
} from "./mock";

import { index } from "./index";

describe("watch history indexer", () => {
  test("should recognise and index WatchAction", async () => {
    const indexingProps = index(hydraWatchActionLd);

    expect(indexingProps).toEqual({
      props: hydraWatchRecord,
      key: hydraDocHash,
    });
  });

  test("should recognise and index WatchAction without start and end time", async () => {
    // eslint-disable-next-line unused-imports/no-unused-vars-ts,@typescript-eslint/no-unused-vars
    const indexingProps = index(definitionWatchActionWithoutDatesLd);

    expect(indexingProps).toEqual({
      props: definitionWatchRecordWithoutDates,
      key: definitionDocHash,
    });
  });

  test("should ignore other linked data type", async () => {});

  test("should ignore WatchAction without target", async () => {});

  test("should ignore WatchAction with url that is not hash uri", async () => {});
});
