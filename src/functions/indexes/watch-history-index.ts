import { WatchAction } from "../../components/watch-history/watch-action";
import { HashUri } from "../../libs/hash";
import {
  storeGet,
  StoreName,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { isTypeEqualTo } from "../../libs/linked-data";
import { LinkedDataDelete } from "../store/local-store";
import { registerRepositoryVersion } from "../store/repository";
import { newUriWithFragment } from "../url-hijack";

import {
  createDynamicStoreProvider,
  DynamicStoreProvider,
} from "./dynamic-repo-index";
import { Indexer, UpdateIndex } from "./types";

export type WatchHistoryQuery = HashUri;
type WatchHistoryRecord = {
  fragment?: string;
  uri: string;
  startTime?: string;
  endTime?: string;
  eventId: HashUri;
};
export type WatchHistoryStore = StoreProvider<WatchHistoryRecord>;
export type WatchHistoryIndex = (
  ldId: HashUri
) => Promise<WatchHistoryRecord | undefined>;

export const watchHistoryStoreName = "watch-history-index" as StoreName;

export const index: Indexer<WatchHistoryRecord> = (ld) => {
  if (!isTypeEqualTo(ld, "WatchAction")) return;
  const watchAction = (ld as unknown) as WatchAction;
  const target = watchAction.target;
  if (!target || typeof target !== "string") return;
  const { fragment, uri } = newUriWithFragment(target);

  const startTime =
    typeof watchAction.startTime === "string"
      ? watchAction.startTime
      : undefined;

  const endTime =
    typeof watchAction.endTime === "string" ? watchAction.endTime : undefined;
  return {
    props: { fragment, uri, startTime, endTime, eventId: ld["@id"] },
    key: uri as HashUri,
  };
};

export const createWatchHistoryStore = (): DynamicStoreProvider<WatchHistoryRecord> =>
  createDynamicStoreProvider(watchHistoryStoreName);

export const createWatchHistoryIndex = (
  watchHistoryStore: WatchHistoryStore
): WatchHistoryIndex => async (hashUri) => storeGet(watchHistoryStore, hashUri);

const createWatchHistoryPureIndexer = (
  watchHistoryStore: WatchHistoryStore
): UpdateIndex => async (ld) => {
  const record = index(ld);
  if (!record) return;
  return storePut(watchHistoryStore, record.props, record.key).then(); // ignore storePut result
};

export const createWatchHistoryIndexer = (
  watchHistoryStore: WatchHistoryStore,
  deleteLinkedData: LinkedDataDelete
): UpdateIndex => async (ld) => {
  const record = index(ld);
  if (!record) return;
  const previous = await storeGet(watchHistoryStore, record.key);
  if (previous) {
    // we don't want to pollute space with all watch events so we store only last one
    await deleteLinkedData(previous.eventId);
  }
  return storePut(watchHistoryStore, record.props, record.key).then(); // ignore storePut result
};

registerRepositoryVersion({
  version: 7,
  stores: [{ name: watchHistoryStoreName }],
  index: {
    storeName: watchHistoryStoreName,
    indexerCreator: createWatchHistoryPureIndexer,
  },
});
