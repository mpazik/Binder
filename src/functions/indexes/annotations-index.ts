import type { Annotation } from "../../components/annotations/annotation";
import { isFragmentSelector } from "../../components/annotations/annotation";
import type { HashUri } from "../../libs/hash";
import type { StoreName, StoreProvider } from "../../libs/indexeddb";
import { storeGet, storePut } from "../../libs/indexeddb";
import { isTypeEqualTo } from "../../libs/linked-data";
import { registerRepositoryVersion } from "../store/repository";

import type { DynamicRepoIndex } from "./dynamic-repo-index";
import { createDynamicIndex2 } from "./dynamic-repo-index";
import type { UpdateIndex } from "./types";

export type DocumentAnnotationsQuery = {
  hash: HashUri;
  fragment?: string;
};
export type AnnotationsStore = StoreProvider<HashUri[]>;
export type AnnotationsIndex = DynamicRepoIndex<
  DocumentAnnotationsQuery,
  HashUri[]
>;

const annotationsIndexStoreName = "annotations-index" as StoreName;

const recordKey = (documentHashUri: HashUri, fragment?: string) =>
  fragment ? `${documentHashUri}:${fragment}` : documentHashUri;

export const createSearchAnnotationsIndex = (
  store: AnnotationsStore
): AnnotationsIndex["search"] => async ({ hash, fragment }) =>
  storeGet<HashUri[]>(
    store,
    recordKey(hash, fragment)
  ).then((annotations = [] as HashUri[]) => [{ props: annotations, hash }]);

const createAnnotationsIndexer = (store: AnnotationsStore): UpdateIndex => {
  return async (ld) => {
    if (!isTypeEqualTo(ld, "Annotation")) return;
    const annotation = (ld as unknown) as Annotation;
    const target = annotation.target;
    if (!target || typeof target !== "object") return;
    const source = target.source as HashUri;
    if (!source) return;

    const selector = annotation.target.selector;
    const fragment = selector
      ? isFragmentSelector(selector)
        ? selector.value
        : undefined
      : undefined;
    const key: string = recordKey(source, fragment);

    const annotations = await storeGet<HashUri[]>(store, key);

    if (annotations) {
      await storePut(store, [...annotations, ld["@id"]], key);
    } else {
      await storePut(store, [ld["@id"]], key);
    }
    return;
  };
};

export const createAnnotationsIndex = (): AnnotationsIndex =>
  createDynamicIndex2(
    annotationsIndexStoreName,
    createSearchAnnotationsIndex,
    createAnnotationsIndexer
  );

registerRepositoryVersion({
  version: 5,
  stores: [{ name: annotationsIndexStoreName }],
});
