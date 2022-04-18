import type { ArrayChange, Callback, ClosableProvider, Predicate } from "linki";
import {
  asyncMap,
  defined,
  filter,
  link,
  map,
  pick,
  pipe,
  withErrorLogging,
} from "linki";

import type {
  Complete,
  TaskObject,
} from "../../../components/view-blocks/tasks";
import { removeItem } from "../../../libs/async-pool";
import { throwIfUndefined } from "../../../libs/errors";
import type { HashUri } from "../../../libs/hash";
import type { StoreName, StoreProvider } from "../../../libs/indexeddb";
import { reqToPromise, storeGet, storePut } from "../../../libs/indexeddb";
import type { LinkedDataWithHashId } from "../../../libs/jsonld-format";
import { getHash, getType } from "../../../libs/linked-data";
import {
  pickContext,
  removeContext,
  splitMap,
  withContext,
} from "../../../libs/linki";
import type { LinkedDataStoreRead } from "../../store/local-store";
import type { RepositoryDb } from "../../store/repository";
import { registerRepositoryVersion } from "../../store/repository";
import type { DynamicStoreProvider } from "../dynamic-repo-index";
import { createDynamicStoreProvider } from "../dynamic-repo-index";
import type { UpdateIndex } from "../types";

export type CompletionRecord = {
  object: HashUri;
} & ({ completed: 0 } | { completed: 1; timestamp: number; eventId: HashUri });
type CompletionRecordChange = {
  current: CompletionRecord;
  previous?: CompletionRecord;
};

export type CompletionStore = StoreProvider<CompletionRecord>;
export const completionStoreName = "completed-index" as StoreName;

const completableTypes = ["Task"];

export const index = async (
  store: CompletionStore,
  ld: LinkedDataWithHashId
): Promise<CompletionRecordChange | undefined> => {
  const type = getType(ld);
  if (!type) return;
  if (type === "Complete") {
    const obj = ((ld as unknown) as Complete).object;
    const published = ((ld as unknown) as Complete).published;
    if (!obj || !published) return;
    const previous = await storeGet<CompletionRecord>(store, obj);
    if (!previous) {
      console.error("Can not complete not existing task", obj);
      return;
    }
    return {
      current: {
        object: obj,
        completed: 1,
        timestamp: Date.parse(published),
        eventId: getHash(ld),
      },
      previous,
    };
  } else if (type === "Undo") {
    const completionEventId = ((ld as unknown) as Complete).object;
    const previous = await reqToPromise<CompletionRecord>(
      store().index("eventId").get(completionEventId)
    );
    if (!previous) return;
    if (!previous.completed) {
      console.error("Can not undo uncompleted task", previous.object);
      return;
    }
    return {
      current: {
        object: previous.object,
        completed: 0,
      },
      previous,
    };
  } else if (completableTypes.includes(type)) {
    const id = ld["@id"];
    if (!id) return;

    const previous = await storeGet<CompletionRecord>(store, id);
    if (previous) {
      console.log(
        "Ignored an older event of completable entity indexing",
        ld,
        previous
      );
      return;
    }
    return {
      current: {
        object: id,
        completed: 0,
      },
    };
  }
};

export const createCompletionStore = (): DynamicStoreProvider<CompletionRecord> =>
  createDynamicStoreProvider(completionStoreName);

export type CompletionQuery =
  | {
      object: HashUri;
    }
  | {
      completed: boolean;
    }
  | {
      since: number;
      until: number;
    };
type TodosChange = ArrayChange<TaskObject, HashUri>;
export type CompletionSubscribe = (
  q: CompletionQuery
) => ClosableProvider<TodosChange>;

const satisfiesQuery = (
  query: CompletionQuery
): Predicate<CompletionRecord> => {
  if (defined((query as { object: HashUri }).object)) {
    const objectHash = (query as { object: HashUri }).object;

    return (record: CompletionRecord) => record.object === objectHash;
  } else if (defined((query as { completed: boolean }).completed)) {
    const completedQuery = (query as { completed: boolean }).completed ? 1 : 0;

    return ({ completed }: CompletionRecord) => completed === completedQuery;
  } else if (
    defined((query as { since: number }).since) &&
    defined((query as { until: number }).until)
  ) {
    const since = (query as { since: number }).since;
    const until = (query as { until: number }).until;

    return (record: CompletionRecord) =>
      record.completed === 1 &&
      (record.timestamp >= since || record.timestamp < until);
  }
  return () => false;
};

const crateTaskObjectBuilder = (ldStoreRead: LinkedDataStoreRead) => async (
  record: CompletionRecord
): Promise<TaskObject> => {
  const entity = throwIfUndefined(await ldStoreRead(record.object));
  const id: HashUri = entity["@id"];
  const content = entity["content"] as string;
  return record.completed
    ? {
        id,
        content,
        completed: true,
        completionTime: new Date(record.timestamp),
      }
    : {
        id,
        content,
        completed: false,
      };
};
const crateTaskObjectsBuilder = (
  builder: (record: CompletionRecord) => Promise<TaskObject>
) => async (records: CompletionRecord[]): Promise<TaskObject[]> =>
  Promise.all(records.map(builder));

type RecordWithContext = [
  CompletionRecordChange,
  { currentMatch: boolean; previousMatch: boolean }
];

export const createCompletionSubscribe = (
  store: CompletionStore,
  ldStoreRead: LinkedDataStoreRead,
  addListener: Callback<Callback<CompletionRecordChange>>,
  removeListener: Callback<Callback<CompletionRecordChange>>
): CompletionSubscribe => (query) => (callback) => {
  const taskObjectBuilder = crateTaskObjectBuilder(ldStoreRead);
  const taskObjectsBuilder = crateTaskObjectsBuilder(taskObjectBuilder);
  let closed = false;

  const sendTask: Callback<CompletionRecord> = link(
    withErrorLogging(asyncMap(taskObjectBuilder)),
    filter(() => !closed),
    map((it) => ["set", it] as TodosChange),
    callback
  );
  const sendRemove: Callback<CompletionRecord> = link(
    map((it) => ["del", it.object] as TodosChange),
    callback
  );

  if (defined((query as { object: HashUri }).object)) {
    const objectHash = (query as { object: HashUri }).object;

    storeGet<CompletionRecord>(store, objectHash).then(
      link(
        filter<CompletionRecord | undefined, CompletionRecord>(defined),
        sendTask
      )
    );
  } else if (defined((query as { completed: boolean }).completed)) {
    const completed = (query as { completed: boolean }).completed ? 1 : 0;
    reqToPromise<CompletionRecord[]>(
      store().index("completed").getAll(completed)
    )
      .then((it) => {
        if (closed) return;
        return taskObjectsBuilder(it);
      })
      .then((it) => {
        if (closed || !it) return;
        callback(["to", it] as TodosChange);
      });
  } else if (
    defined((query as { since: number }).since) &&
    defined((query as { until: number }).until)
  ) {
    const since = (query as { since: number }).since;
    const until = (query as { until: number }).until;
    reqToPromise<CompletionRecord[]>(
      store()
        .index("timestamp")
        .getAll(IDBKeyRange.bound(since, until, false, true))
    )
      .then((it) => {
        if (closed) return;
        return taskObjectsBuilder(it);
      })
      .then((it) => {
        if (closed || !it) return;
        callback(["to", it] as TodosChange);
      });
  }

  const queryCheck = satisfiesQuery(query);

  // An experiment of working with contexts. It is a little clunky but possible
  const listener: Callback<CompletionRecordChange> = link(
    map(
      withContext(({ current, previous }) => ({
        currentMatch: queryCheck(current),
        previousMatch: previous ? queryCheck(previous) : false,
      }))
    ),
    filter(
      pipe(
        pickContext(),
        ({ currentMatch, previousMatch }) => currentMatch !== previousMatch
      )
    ),
    splitMap<RecordWithContext, CompletionRecord>(
      pipe(pickContext(), pick("currentMatch")),
      pipe(removeContext(), pick("current"))
    ),
    [sendTask, sendRemove]
  );

  addListener(listener);
  return () => {
    removeListener(listener);
    closed = true;
  };
};

export const createCompletionIndexer = (
  store: CompletionStore,
  callback: Callback<CompletionRecordChange>
): UpdateIndex => async (ld) => {
  const record = await index(store, ld);
  if (!record) return;

  await storePut(store, record.current, record.current.object);
  callback(record);
};

export type SearchCompletionIndex = (
  taskId: HashUri
) => Promise<CompletionRecord | undefined>;
export const createCompletionIndex = (): {
  searchIndex: SearchCompletionIndex;
  switchRepo: (db: RepositoryDb) => void;
  update: UpdateIndex;
  subscribe: (ldRead: LinkedDataStoreRead) => CompletionSubscribe;
} => {
  let update: UpdateIndex | undefined;
  let search: SearchCompletionIndex | undefined;
  let subscribe:
    | ((ldRead: LinkedDataStoreRead) => CompletionSubscribe)
    | undefined;

  return {
    searchIndex: (key) => throwIfUndefined(search)(key),
    update: (ld) => throwIfUndefined(update)(ld),
    subscribe: (ldRead: LinkedDataStoreRead) => (q) =>
      throwIfUndefined(subscribe)(ldRead)(q),
    switchRepo: (db) => {
      const store: CompletionStore = db.getStoreProvider(completionStoreName);
      const listeners: Callback<CompletionRecordChange>[] = [];

      update = createCompletionIndexer(store, (data) => {
        listeners.forEach((listener) => listener(data));
      });
      search = (hash) => storeGet(store, hash);
      subscribe = (ldRead: LinkedDataStoreRead) =>
        createCompletionSubscribe(
          store,
          ldRead,
          (l) => listeners.push(l),
          (l) => removeItem(listeners, l)
        );
    },
  };
};

registerRepositoryVersion({
  version: 9,
  stores: [
    {
      name: completionStoreName,
      indexes: [
        { name: "completed", keyPath: "completed", options: { unique: false } },
        { name: "timestamp", keyPath: "timestamp", options: { unique: false } },
        { name: "eventId", keyPath: "eventId", options: { unique: true } },
      ],
    },
  ],
  index: {
    indexerCreator: (provider) => createCompletionIndexer(provider, () => {}),
    storeName: completionStoreName,
  },
});
