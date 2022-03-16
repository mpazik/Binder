import type { Callback, Close, Processor, Transformer } from "linki";
import { link, map, pick, pipe } from "linki";

import { filter, isEqual } from "../../../../linki/src";
import type { Annotation } from "../../components/annotations/annotation";
import { isFragmentSelector } from "../../components/annotations/annotation";
import type { Uri } from "../../components/common/uri";
import { removeItem } from "../../libs/async-pool";
import { throwIfUndefined } from "../../libs/errors";
import type { HashUri } from "../../libs/hash";
import type { StoreName, StoreProvider } from "../../libs/indexeddb";
import { storeGet, storePut } from "../../libs/indexeddb";
import type { LinkedDataWithHashId } from "../../libs/jsonld-format";
import { isTypeEqualTo } from "../../libs/linked-data";
import { registerRepositoryVersion } from "../store/repository";

import type { DynamicRepoIndex } from "./dynamic-repo-index";
import type { UpdateIndex } from "./types";

export type AnnotationsQuery = {
  reference: Uri;
  fragment?: string;
};

export type AnnotationsSubscribeIndex = Processor<AnnotationsQuery, HashUri>;

type AnnotationIndexProps = HashUri[];
export type AnnotationsStore = StoreProvider<AnnotationIndexProps>;
export type AnnotationsIndex = DynamicRepoIndex<
  AnnotationsQuery,
  AnnotationIndexProps
> & {
  subscribe: AnnotationsSubscribeIndex;
};

const annotationsIndexStoreName = "annotations-index" as StoreName;

type IndexKey = string;
const recordKey = (documentUri: Uri, fragment?: string): IndexKey =>
  fragment ? `${documentUri}:${fragment}` : documentUri;

type IndexData = { key: IndexKey; hash: HashUri };

const index: Transformer<LinkedDataWithHashId, IndexData | undefined> = (
  ld
) => {
  if (!isTypeEqualTo(ld, "Annotation")) return;
  const annotation = (ld as unknown) as Annotation;
  const target = annotation.target;
  if (!target || typeof target !== "object") return;
  const source = target.source as Uri;
  if (!source) return;

  const selector = annotation.target.selector;
  const fragment = selector
    ? isFragmentSelector(selector)
      ? selector.value
      : undefined
    : undefined;
  const key: string = recordKey(source, fragment);

  return { key, hash: ld["@id"] };
};

const createAnnotationsIndexer = (
  store: AnnotationsStore,
  onIndexed: Callback<IndexData>
): UpdateIndex => {
  return async (ld) => {
    const result = index(ld);
    if (!result) return;

    const { key, hash } = result;
    const annotations = (await storeGet<HashUri[]>(store, key)) ?? [];

    await storePut(store, [...annotations, hash], key);
    onIndexed(result);
  };
};

export const createSubscribeAnnotationsIndex = (
  store: AnnotationsStore,
  addListener: Callback<Callback<IndexData>>,
  removeListener: Callback<Callback<IndexData>>
): AnnotationsSubscribeIndex => (callback) => {
  let closeOldListener: Close | undefined;
  let currentKey: IndexKey | undefined;
  return ({ reference, fragment }) => {
    if (closeOldListener) closeOldListener();
    const key = recordKey(reference, fragment);
    currentKey = key;
    storeGet<AnnotationIndexProps>(store, recordKey(reference, fragment)).then(
      (annotations = [] as AnnotationIndexProps) => {
        if (currentKey !== key) {
          return; // there was another query in between so we want to push stale results
        }
        annotations.forEach(callback);
      }
    );

    const listener: Callback<IndexData> = link(
      filter(pipe(pick("key"), isEqual(key))),
      map(pick("hash")),
      callback
    );

    addListener(listener);
    closeOldListener = () => removeListener(listener);
  };
};

export const createAnnotationsIndex = (): AnnotationsIndex => {
  let update: UpdateIndex | undefined;
  let subscribe: AnnotationsSubscribeIndex | undefined;

  return {
    search: () => {
      throw new Error("not implemented");
    },
    update: (ld) => throwIfUndefined(update)(ld),
    subscribe: (q) => throwIfUndefined(subscribe)(q),
    switchRepo: (db) => {
      const store = db.getStoreProvider(annotationsIndexStoreName);
      const listeners: Callback<IndexData>[] = [];

      update = createAnnotationsIndexer(store, (data) => {
        listeners.forEach((listener) => listener(data));
      });
      subscribe = createSubscribeAnnotationsIndex(
        store,
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
