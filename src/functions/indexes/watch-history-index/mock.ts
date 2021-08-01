import { WatchAction } from "../../../components/watch-history/watch-action";
import { HashUri } from "../../../libs/hash";
import { LinkedDataWithHashId } from "../../../libs/jsonld-format";
import { definitionDocHash, hydraDocHash } from "../directory-index/mock";

import { WatchHistoryRecord, WatchHistorySearch } from "./index";

export const hydraWatchActionHash = "nih:sha-256;1e784540af3bcf44ce196c327d6ffcec8aab064fe3d030c9913905e3243adffe" as HashUri;
export const hydraWatchActionLd: WatchAction & LinkedDataWithHashId = {
  "@context": "https://schema.org",
  "@type": "WatchAction",
  "@id": hydraWatchActionHash,
  startTime: "2021-07-25T09:11:52.680Z",
  endTime: "2021-07-25T09:12:44.692Z",
  target: hydraDocHash,
};

export const hydraWatchRecord = {
  uri: hydraDocHash,
  startTime: "2021-07-25T09:11:52.680Z",
  endTime: "2021-07-25T09:12:44.692Z",
  eventId: hydraWatchActionHash,
};

export const definitionWatchActionHash = "nih:sha-256;6113243c28667f37dfd49944c999fd9b84bc1dc5b4b65708106cdb7d89fa0842" as HashUri;
export const definitionWatchActionWithoutDatesLd: WatchAction &
  LinkedDataWithHashId = {
  "@context": "https://schema.org",
  "@type": "WatchAction",
  "@id": definitionWatchActionHash,
  target: `${definitionDocHash}#content`,
};

export const definitionWatchRecordWithoutDates = {
  fragment: "content",
  uri: definitionDocHash,
  eventId: definitionWatchActionHash,
};

export const firetWatchRecord = {
  fragment: "content",
  uri: "nih:sha-256;8f8a46fb60deb2d1daf54ceffc6a502328ad6dca1a3bcb234dab0963df1b4806" as HashUri,
  startTime: "2021-07-25T07:16:15.395Z",
  endTime: "2021-07-25T07:16:21.441Z",
  eventId: "nih:sha-256;1a42dde919fbfc900747aa51f879d026b9cc4fb8758173573a6b8bfc7a624eb8" as HashUri,
};

export const watchRecords: WatchHistoryRecord[] = [
  hydraWatchRecord,
  definitionWatchRecordWithoutDates,
  firetWatchRecord,
];

export const createInMemoryWatchHistorySearch = (
  records: WatchHistoryRecord[]
): WatchHistorySearch => async (hashUris) => {
  return hashUris ? records.filter((it) => hashUris.includes(it.uri)) : records;
};
