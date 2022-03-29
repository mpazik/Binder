import type { ArrayChange, Callback, ClosableProvider, Predicate } from "linki";
import { cast, defined, filter, isEqual, link, map, pick, pipe } from "linki";

import type {
  Annotation,
  AnnotationMotivation,
} from "../../components/annotations/annotation";
import { isFragmentSelector } from "../../components/annotations/annotation";
import type { Uri } from "../../components/common/uri";
import { removeItem } from "../../libs/async-pool";
import { throwIfUndefined } from "../../libs/errors";
import type { HashUri } from "../../libs/hash";
import type { StoreName, StoreProvider } from "../../libs/indexeddb";
import { storeGet, storePut } from "../../libs/indexeddb";
import type { LinkedDataWithHashId } from "../../libs/jsonld-format";
import { getHash, isTypeEqualTo } from "../../libs/linked-data";
import type { NamedAction } from "../../libs/named-state";
import { handleAction } from "../../libs/named-state";
import type { Delete } from "../../vocabulary/activity-streams";
import type { LinkedDataStoreRead } from "../store/local-store";
import { registerRepositoryVersion } from "../store/repository";

import type { DynamicRepoIndex } from "./dynamic-repo-index";
import type { UpdateIndex } from "./types";

export type AnnotationsQuery = {
  reference: Uri;
  fragment?: string;
  motivation?: AnnotationMotivation;
};

export type AnnotationChange = ArrayChange<Annotation, HashUri>;
export type AnnotationsSubscribe = (
  q: AnnotationsQuery
) => ClosableProvider<AnnotationChange>;

type AnnotationIndexProps = HashUri[];
export type AnnotationsStore = StoreProvider<AnnotationIndexProps>;
export type AnnotationsIndex = Omit<
  DynamicRepoIndex<AnnotationsQuery, AnnotationIndexProps>,
  "update"
> & {
  update: (ldRead: LinkedDataStoreRead) => UpdateIndex;
  subscribe: (ldRead: LinkedDataStoreRead) => AnnotationsSubscribe;
};

const annotationsIndexStoreName = "annotations-index" as StoreName;

type IndexKey = string;
const recordKey = (documentUri: Uri, fragment?: string): IndexKey =>
  fragment ? `${documentUri}:${fragment}` : documentUri;

const recordKeyFromAnnotation = (
  annotation: Partial<Annotation>
): IndexKey | undefined => {
  const target = annotation.target;
  if (!target || typeof target !== "object") return;
  const source = target.source as Uri;
  if (!source) return;

  const selector = target.selector;
  const fragment = selector
    ? isFragmentSelector(selector)
      ? selector.value
      : undefined
    : undefined;
  return recordKey(source, fragment);
};

type IndexData =
  | NamedAction<"add", { key: IndexKey; annotation: Annotation }>
  | NamedAction<"remove", { key: IndexKey; annotation: Annotation }>;

const createAnnotationsIndexer = (
  store: AnnotationsStore,
  ldStoreRead: LinkedDataStoreRead,
  onIndexed: Callback<IndexData>
): UpdateIndex => {
  return async (ld) => {
    if (isTypeEqualTo(ld, "Annotation")) {
      const annotation = (ld as unknown) as Annotation;
      const key = recordKeyFromAnnotation(annotation);
      if (!key) return;
      const hash = getHash(ld);

      const annotations = (await storeGet<HashUri[]>(store, key)) ?? [];
      await storePut(store, [...annotations, hash], key);
      onIndexed(["add", { key, annotation }]);
    } else if (isTypeEqualTo(ld, "Delete")) {
      const objectUri = ((ld as unknown) as Delete).object as HashUri;
      if (!objectUri) return;
      const object = await ldStoreRead(objectUri);
      if (!object || !isTypeEqualTo(object, "Annotation")) return;
      const annotation = (object as unknown) as Annotation;
      const key = recordKeyFromAnnotation(annotation);
      if (!key) return;
      const annotations = (await storeGet<HashUri[]>(store, key)) ?? [];
      removeItem(annotations, objectUri);
      await storePut(store, [...annotations], key);
      onIndexed(["remove", { key, annotation }]);
    }
  };
};

const matchesMotivation = (
  motivationToMatch?: AnnotationMotivation
): Predicate<Annotation> =>
  motivationToMatch
    ? (annotation) => annotation.motivation === motivationToMatch
    : () => true;

export const createSubscribeAnnotationsIndex = (
  store: AnnotationsStore,
  ldStoreRead: LinkedDataStoreRead,
  addListener: Callback<Callback<IndexData>>,
  removeListener: Callback<Callback<IndexData>>
): AnnotationsSubscribe => ({ reference, fragment, motivation }) => (
  callback
) => {
  const key = recordKey(reference, fragment);
  let closed = false;
  storeGet<AnnotationIndexProps>(store, recordKey(reference, fragment))
    .then((annotationsIds = [] as AnnotationIndexProps) => {
      if (closed) return;
      return Promise.all(annotationsIds.map(ldStoreRead));
    })
    .then((lds) => {
      if (closed || !lds) return;
      const annotations: Annotation[] = lds
        .filter(defined)
        .map(cast<LinkedDataWithHashId, Annotation>())
        .filter(matchesMotivation(motivation));
      callback(["to", annotations]);
    });

  const listener: Callback<IndexData> = link(
    filter(pipe((it) => it[1].key, isEqual(key))),
    (action) => {
      handleAction(action, {
        add: link(
          filter(pipe(pick("annotation"), matchesMotivation(motivation))),
          map(({ annotation }) => ["set", annotation] as AnnotationChange),
          callback
        ),
        remove: link(
          filter(pipe(pick("annotation"), matchesMotivation(motivation))),
          map(
            ({ annotation }) =>
              [
                "del",
                getHash((annotation as unknown) as LinkedDataWithHashId),
              ] as AnnotationChange
          ),
          callback
        ),
      });
    }
  );

  addListener(listener);
  return () => {
    removeListener(listener);
    closed = true;
  };
};

export const createAnnotationsIndex = (): AnnotationsIndex => {
  let update: ((ldRead: LinkedDataStoreRead) => UpdateIndex) | undefined;
  let subscribe:
    | ((ldRead: LinkedDataStoreRead) => AnnotationsSubscribe)
    | undefined;

  return {
    search: () => {
      throw new Error("not implemented");
    },
    update: (ldRead: LinkedDataStoreRead) => (ld) =>
      throwIfUndefined(update)(ldRead)(ld),
    subscribe: (ldRead: LinkedDataStoreRead) => (q) =>
      throwIfUndefined(subscribe)(ldRead)(q),
    switchRepo: (db) => {
      const store = db.getStoreProvider(annotationsIndexStoreName);
      const listeners: Callback<IndexData>[] = [];

      update = (ldRead: LinkedDataStoreRead) =>
        createAnnotationsIndexer(store, ldRead, (data) => {
          listeners.forEach((listener) => listener(data));
        });
      subscribe = (ldRead: LinkedDataStoreRead) =>
        createSubscribeAnnotationsIndex(
          store,
          ldRead,
          (l) => listeners.push(l),
          (l) => removeItem(listeners, l)
        );
    },
  };
};

registerRepositoryVersion({
  version: 5,
  stores: [{ name: annotationsIndexStoreName }],
});
