import type { ArrayChange, Callback, ClosableProvider } from "linki";
import {
  asyncMap,
  cast,
  filter,
  ignore,
  link,
  map,
  pick,
  pipe,
  withErrorLogging,
} from "linki";

import type {
  Habit,
  HabitObject,
  HabitTrackEvent,
  HabitTrackEventObject,
  HabitTrackEventUri,
  HabitUri,
} from "../../../components/view-blocks/habits/model";
import { removeItem } from "../../../libs/async-pool";
import type { IntervalUri } from "../../../libs/calendar-ld";
import { throwIfUndefined, throwIfUndefined2 } from "../../../libs/errors";
import type { HashUri } from "../../../libs/hash";
import type { StoreName, StoreProvider } from "../../../libs/indexeddb";
import { storeGet, storeGetAll, storePut } from "../../../libs/indexeddb";
import { getHash, getType } from "../../../libs/linked-data";
import { withContext } from "../../../libs/linki";
import type { LinkedDataStoreRead } from "../../store/local-store";
import type { RepositoryDb } from "../../store/repository";
import { registerRepositoryVersion } from "../../store/repository";
import type { DynamicStoreProvider } from "../dynamic-repo-index";
import { createDynamicStoreProvider } from "../dynamic-repo-index";
import type { UpdateIndex } from "../types";

import { getMinMaxString } from "./utils";

export type HabitRecord = {
  habit: HashUri;
};

export type HabitTrackEventRecord = {
  habit: HashUri;
  interval: IntervalUri;
  event: HabitTrackEventUri;
  published: string;
};

export type HabitStore = StoreProvider<HabitRecord>;
export type HabitTrackEventStore = StoreProvider<HabitTrackEventRecord>;
export const habitStoreName = "habit-index" as StoreName;
export const habitTrackEventsStoreName = "habit-track-events-index" as StoreName;

export const createHabitStore = (): DynamicStoreProvider<HabitRecord> =>
  createDynamicStoreProvider(habitStoreName);

type IntervalUris = [IntervalUri, ...IntervalUri[]];
export type HabitQuery = {
  intervals: IntervalUri[];
};
type HabitChange = ArrayChange<HabitObject, HabitUri>;
export type HabitSubscribe = (q: HabitQuery) => ClosableProvider<HabitChange>;

type HabitObjectInput = [HabitUri, IntervalUris];
const crateHabitObjectBuilder = (
  ldStoreRead: LinkedDataStoreRead,
  habitTrackEventStore: HabitTrackEventStore
) => async ([habitUri, intervals]: HabitObjectInput): Promise<HabitObject> => {
  const [start, end] = getMinMaxString(intervals);
  const events = await storeGetAll<HabitTrackEventRecord>(
    habitTrackEventStore,
    IDBKeyRange.bound([habitUri, start], [habitUri, end], false, false)
  );
  const trackEvents: HabitTrackEventObject[] = (
    await Promise.all(
      events
        .filter(({ interval }) => intervals.includes(interval))
        .map(pick("event"))
        .map(ldStoreRead)
    )
  ).map(
    pipe(throwIfUndefined2(), cast(), (it: HabitTrackEvent) => ({
      interval: it.target,
      status: it.result,
    }))
  );

  const habit = (throwIfUndefined(
    await ldStoreRead(habitUri)
  ) as unknown) as Habit;

  return {
    id: habitUri,
    title: habit.title,
    emojiIcon: habit.emojiIcon,
    description: habit.description,
    trackEvents,
  };
};

export const createHabitSubscribe = (
  habitStore: HabitStore,
  habitTrackEventStore: HabitTrackEventStore,
  ldStoreRead: LinkedDataStoreRead,
  addListener: Callback<Callback<HabitUri>>,
  removeListener: Callback<Callback<HabitUri>>
): HabitSubscribe => ({ intervals }) => (callback) => {
  if (intervals.length === 0) return () => {};

  const habitObjectBuilder = crateHabitObjectBuilder(
    ldStoreRead,
    habitTrackEventStore
  );
  let closed = false;
  const sendTask: Callback<HabitObjectInput> = link(
    withErrorLogging(asyncMap(habitObjectBuilder)),
    filter(() => !closed),
    map((it) => ["set", it] as HabitChange),
    callback
  );

  const withIntervalsContext = withContext<HabitUri, IntervalUris>(
    () => intervals as IntervalUris
  );
  storeGetAll<HabitRecord>(habitStore)
    .then((habits) => {
      if (closed) return;
      return Promise.all(
        habits
          .map(pipe(pick("habit"), withIntervalsContext))
          .map(habitObjectBuilder)
      );
    })
    .then((habitObjects) => {
      if (closed || !habitObjects) return;
      callback(["to", habitObjects] as HabitChange);
    });

  const listener: Callback<HabitUri> = link(
    map(withIntervalsContext),
    sendTask
  );
  addListener(listener);
  return () => {
    removeListener(listener);
    closed = true;
  };
};

export const createHabitIndexer = (
  store: HabitStore,
  callback: Callback<HabitUri>
): UpdateIndex => async (ld) => {
  const type = getType(ld);
  if (!type) return;
  if (type !== "Habit") return;
  const id = getHash(ld) as HabitUri;
  if (!id) return;

  await storePut(store, { habit: id });
  callback(id);
};

export const createHabitTrackEventIndexer = (
  store: HabitTrackEventStore,
  callback: Callback<HabitUri>
): UpdateIndex => async (ld) => {
  const type = getType(ld);
  if (!type) return;
  if (type !== "HabitTrackEvent") return;
  const habit = ld["object"] as HabitUri;
  const interval = ld["target"] as IntervalUri;
  const published = ld["published"] as string;
  if (!habit || !interval || !published) return;

  const previous = await storeGet<HabitTrackEventRecord>(store, habit);
  if (
    previous &&
    published &&
    previous.published &&
    published < previous.published
  ) {
    // it happens when you locally update field before synchronisation will finish that could have a previous value
    console.log("Ignore older habit change event");
    return;
  }

  await storePut<HabitTrackEventRecord>(store, {
    habit,
    interval,
    event: getHash(ld),
    published,
  });
  callback(habit);
};

export const createHabitIndex = (): {
  switchRepo: (db: RepositoryDb) => void;
  update: UpdateIndex;
  subscribe: (ldRead: LinkedDataStoreRead) => HabitSubscribe;
} => {
  let update: UpdateIndex | undefined;
  let subscribe: ((ldRead: LinkedDataStoreRead) => HabitSubscribe) | undefined;

  return {
    update: (ld) => throwIfUndefined(update)(ld),
    subscribe: (ldRead: LinkedDataStoreRead) => (q) =>
      throwIfUndefined(subscribe ? subscribe(ldRead) : undefined)(q),
    switchRepo: (db) => {
      const habitStore: HabitStore = db.getStoreProvider(habitStoreName);
      const habitTrackEventStore: HabitTrackEventStore = db.getStoreProvider(
        habitTrackEventsStoreName
      );

      const listeners: Callback<HabitUri>[] = [];
      const indexHabit = createHabitIndexer(habitStore, (data) => {
        listeners.forEach((listener) => listener(data));
      });
      const indexHabitTrackEvent = createHabitTrackEventIndexer(
        habitTrackEventStore,
        (data) => {
          listeners.forEach((listener) => listener(data));
        }
      );

      update = (it) =>
        Promise.all([indexHabit(it), indexHabitTrackEvent(it)]).then(ignore);

      subscribe = (ldRead: LinkedDataStoreRead) =>
        createHabitSubscribe(
          habitStore,
          habitTrackEventStore,
          ldRead,
          (l) => listeners.push(l),
          (l) => removeItem(listeners, l)
        );
    },
  };
};

registerRepositoryVersion({
  version: 10,
  stores: [
    {
      name: habitStoreName,
      params: { keyPath: "habit" },
    },
  ],
  index: {
    indexerCreator: (provider) => createHabitIndexer(provider, () => {}),
    storeName: habitStoreName,
  },
});
registerRepositoryVersion({
  version: 11,
  stores: [
    {
      name: habitTrackEventsStoreName,
      params: { keyPath: ["habit", "interval"] },
    },
  ],
  index: {
    indexerCreator: (provider) =>
      createHabitTrackEventIndexer(provider, () => {}),
    storeName: habitTrackEventsStoreName,
  },
});
