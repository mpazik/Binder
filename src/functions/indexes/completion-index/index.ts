import type { ArrayChange, Callback, Close, Predicate, Processor } from "linki";
import {
  asyncMapWithErrorHandler,
  defined,
  filter,
  link,
  map,
  pick,
  pipe,
} from "linki";

import type { TaskObject } from "../../../components/tasks/model";
import type { Complete } from "../../../components/tasks/productivity-vocabulary";
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

export const index = (
  ld: LinkedDataWithHashId
): CompletionRecord | undefined => {
  const type = getType(ld);
  if (!type) return;
  if (type === "Complete") {
    const obj = ((ld as unknown) as Complete).object;
    const published = ((ld as unknown) as Complete).published;
    if (!obj || !published) return;
    return {
      object: obj,
      completed: 1,
      timestamp: Date.parse(published),
      eventId: getHash(ld),
    };
  }
  if (completableTypes.includes(type)) {
    const id = ld["@id"];
    if (!id) return;
    return {
      object: id,
      completed: 0,
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
export type CompletionSubscribeIndex = Processor<CompletionQuery, TodosChange>;

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
): CompletionSubscribeIndex => (callback) => {
  const taskObjectBuilder = crateTaskObjectBuilder(ldStoreRead);
  const taskObjectsBuilder = crateTaskObjectsBuilder(taskObjectBuilder);
  let closeOldListener: Close | undefined;
  const sendTask: Callback<CompletionRecord> = link(
    asyncMapWithErrorHandler(taskObjectBuilder, (error) =>
      console.error(error)
    ),
    map((it) => ["set", it] as TodosChange),
    callback
  );
  const sendRemove: Callback<CompletionRecord> = link(
    map((it) => ["del", it.object] as TodosChange),
    callback
  );

  return (query) => {
    if (closeOldListener) closeOldListener();

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
        .then(taskObjectsBuilder)
        .then((it) => callback(["to", it] as TodosChange));
    } else if (
      defined((query as { since: number }).since) &&
      defined((query as { until: number }).until)
    ) {
      const since = (query as { since: number }).since;
      const until = (query as { until: number }).until;
      reqToPromise<CompletionRecord[]>(
        store()
          .index("timestamp")
          .getAll(IDBKeyRange.bound(since, until, true, false))
      )
        .then(taskObjectsBuilder)
        .then((it) => callback(["to", it] as TodosChange));
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
    closeOldListener = () => removeListener(listener);
  };
};

export const createCompletionIndexer = (
  store: CompletionStore,
  callback: Callback<CompletionRecordChange>
): UpdateIndex => async (ld) => {
  const record = index(ld);
  if (!record) return;
  const previous = await storeGet<CompletionRecord>(store, record.object);
  if (
    previous &&
    record.completed === 1 &&
    previous.completed === 1 &&
    record.timestamp &&
    previous.timestamp &&
    record.timestamp < previous.timestamp
  ) {
    console.log("Ignored an older event");
    return;
  }

  await storePut(store, record, record.object);
  callback({ current: record, previous });
};

export const createCompletionIndex = (): {
  switchRepo: (db: RepositoryDb) => void;
  update: UpdateIndex;
  subscribe: (ldRead: LinkedDataStoreRead) => CompletionSubscribeIndex;
} => {
  let update: UpdateIndex | undefined;
  let subscribe:
    | ((ldRead: LinkedDataStoreRead) => CompletionSubscribeIndex)
    | undefined;

  return {
    update: (ld) => throwIfUndefined(update)(ld),
    subscribe: (ldRead: LinkedDataStoreRead) => (q) =>
      throwIfUndefined(subscribe ? subscribe(ldRead) : undefined)(q),
    switchRepo: (db) => {
      const store = db.getStoreProvider(completionStoreName);
      const listeners: Callback<CompletionRecordChange>[] = [];

      update = createCompletionIndexer(store, (data) => {
        listeners.forEach((listener) => listener(data));
      });
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
