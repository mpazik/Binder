import {
  Annotation,
  isFragmentSelector,
} from "../../components/annotations/annotation";
import { HashUri } from "../../libs/hash";
import {
  createStoreProvider,
  defaultStoreName,
  openSingleStoreDb,
  storeGet,
  StoreProvider,
  storePut,
} from "../../libs/indexeddb";
import { isTypeEqualTo } from "../../libs/linked-data";

import { Indexer } from "./types";

export type DocumentAnnotationsQuery = {
  documentHashUri: HashUri;
  fragment?: string;
};
export type DocumentAnnotationsStore = StoreProvider<HashUri[]>;
export type DocumentAnnotationsIndex = (
  q: DocumentAnnotationsQuery
) => Promise<HashUri[]>;

export const createDocumentAnnotationsIndexStore = (): Promise<DocumentAnnotationsStore> =>
  openSingleStoreDb("document-annotations-index", undefined).then((db) =>
    createStoreProvider(db, defaultStoreName)
  );

const recordKey = (documentHashUri: HashUri, fragment?: string) =>
  fragment ? `${documentHashUri}:${fragment}` : documentHashUri;

export const createDocumentAnnotationsIndex = (
  store: DocumentAnnotationsStore
): DocumentAnnotationsIndex => async ({ documentHashUri, fragment }) =>
  storeGet<HashUri[]>(store, recordKey(documentHashUri, fragment)).then(
    (annotations = [] as HashUri[]) => annotations
  );

export const createDocumentAnnotationsIndexer = (
  store: DocumentAnnotationsStore
): Indexer => {
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

    const documentAnnotations = await storeGet<HashUri[]>(store, key);

    if (documentAnnotations) {
      await storePut(store, [...documentAnnotations, ld["@id"]], key);
    } else {
      await storePut(store, [ld["@id"]], key);
    }
    return;
  };
};
