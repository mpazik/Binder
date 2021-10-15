import type { WatchAction } from "../../../components/watch-history/watch-action";
import { newUriWithFragment } from "../../../libs/browser-providers";
import type { HashUri } from "../../../libs/hash";
import { isHashUri } from "../../../libs/hash";
import type { StoreName, StoreProvider } from "../../../libs/indexeddb";
import { storeGet, storeGetAll, storePut } from "../../../libs/indexeddb";
import { isTypeEqualTo } from "../../../libs/linked-data";
import type { LinkedDataDelete } from "../../store/local-store";
import { registerRepositoryVersion } from "../../store/repository";
import type { DynamicStoreProvider } from "../dynamic-repo-index";
import { createDynamicStoreProvider } from "../dynamic-repo-index";
import type { Indexer, UpdateIndex } from "../types";

export type WatchHistoryQuery = HashUri;
export type WatchHistoryRecord = {
  fragment?: string;
  uri: HashUri;
  startTime?: string;
  endTime?: string;
  eventId: HashUri;
};
export type WatchHistoryStore = StoreProvider<WatchHistoryRecord>;
export type WatchHistoryIndex = (
  ldId: HashUri
) => Promise<WatchHistoryRecord | undefined>;

export type WatchHistorySearch = (
  ldIds?: HashUri[]
) => Promise<WatchHistoryRecord[]>;

export const watchHistoryStoreName = "watch-history-index" as StoreName;

export const index: Indexer<WatchHistoryRecord> = (ld) => {
  if (!isTypeEqualTo(ld, "WatchAction")) return;
  const watchAction = (ld as unknown) as WatchAction;
  const target = watchAction.target;
  if (!target || typeof target !== "string") return;
  const { fragment, uri } = newUriWithFragment(target);
  if (!isHashUri(uri)) return;

  const startTime =
    typeof watchAction.startTime === "string"
      ? watchAction.startTime
      : undefined;

  const endTime =
    typeof watchAction.endTime === "string" ? watchAction.endTime : undefined;
  return {
    props: {
      ...(fragment ? { fragment } : {}),
      uri,
      startTime,
      endTime,
      eventId: ld["@id"],
    },
    key: uri,
  };
};

export const createWatchHistoryStore = (): DynamicStoreProvider<WatchHistoryRecord> =>
  createDynamicStoreProvider(watchHistoryStoreName);

export const createWatchHistoryIndex = (
  watchHistoryStore: WatchHistoryStore
): WatchHistoryIndex => async (hashUri) => storeGet(watchHistoryStore, hashUri);

export const createWatchHistorySearch = (
  watchHistoryStore: WatchHistoryStore
): WatchHistorySearch => async (hashUris) => {
  const all = await storeGetAll(watchHistoryStore);
  if (hashUris === undefined) return all;
  return all.filter((it) => hashUris.includes(it.uri));
};

const createWatchHistoryPureIndexer = (
  watchHistoryStore: WatchHistoryStore
): UpdateIndex => async (ld) => {
  const record = index(ld);
  if (!record) return;
  await storePut(watchHistoryStore, record.props, record.key);
};

export const createWatchHistoryIndexer = (
  watchHistoryStore: WatchHistoryStore,
  deleteLinkedData: LinkedDataDelete
): UpdateIndex => async (ld) => {
  const record = index(ld);
  if (!record) return;
  const previous = await storeGet(watchHistoryStore, record.key);
  if (
    previous &&
    record.props.startTime &&
    previous.startTime &&
    record.props.startTime < previous.startTime
  ) {
    console.log("Ignore older watch event");
    return;
  }

  await storePut(watchHistoryStore, record.props, record.key);

  if (previous) {
    // we don't want to pollute space with all watch events so we store only last one
    await deleteLinkedData(previous.eventId);
  }
};

registerRepositoryVersion({
  version: 7,
  stores: [{ name: watchHistoryStoreName }],
  index: {
    storeName: watchHistoryStoreName,
    indexerCreator: createWatchHistoryPureIndexer,
  },
});
