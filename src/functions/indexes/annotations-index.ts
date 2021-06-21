import {
  Annotation,
  isFragmentSelector,
} from "../../components/annotations/annotation";
import { HashUri } from "../../libs/hash";
import {
  storeGet,
  StoreName,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { isTypeEqualTo } from "../../libs/linked-data";
import { registerRepositoryVersion, RepositoryDb } from "../store/repository";

import { Indexer } from "./types";

export type DocumentAnnotationsQuery = {
  documentHashUri: HashUri;
  fragment?: string;
};
export type AnnotationsStore = StoreProvider<HashUri[]>;
export type AnnotationsIndex = (
  q: DocumentAnnotationsQuery
) => Promise<HashUri[]>;

const annotationsIndexStoreName = "annotations-index" as StoreName;

registerRepositoryVersion({
  version: 5,
  stores: [{ name: annotationsIndexStoreName }],
});

export const createAnnotationsIndexStore = (
  repositoryDb: RepositoryDb
): AnnotationsStore => repositoryDb.getStoreProvider(annotationsIndexStoreName);

const recordKey = (documentHashUri: HashUri, fragment?: string) =>
  fragment ? `${documentHashUri}:${fragment}` : documentHashUri;

export const createAnnotationsIndex = (
  store: AnnotationsStore
): AnnotationsIndex => async ({ documentHashUri, fragment }) =>
  storeGet<HashUri[]>(store, recordKey(documentHashUri, fragment)).then(
    (annotations = [] as HashUri[]) => annotations
  );

export const createAnnotationsIndexer = (store: AnnotationsStore): Indexer => {
  return async (ld) => {
    if (!isTypeEqualTo(ld, "annotation")) return;
    const annotation = (ld as unknown) as Annotation;
    const target = annotation.target;
    if (!target || typeof target !== "object") return;
    const source = target.source as HashUri;
    if (!source) return;

    const selector = annotation.target.selector;
    const fragment = isFragmentSelector(selector) ? selector.value : undefined;
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
