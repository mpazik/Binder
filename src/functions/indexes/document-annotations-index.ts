import {
  Annotation,
  isFragmentSelector,
} from "../../components/annotations/annotation";
import { HashUri } from "../../libs/hash";
import {
  openSingleStoreDb,
  SingleStoreDb,
  storeGet,
  storePut,
} from "../../libs/indexeddb";
import { isTypeEqualTo } from "../../libs/linked-data";
import { Opaque } from "../../libs/types";

import { Indexer } from "./types";

export type DocumentAnnotationsQuery = {
  documentHashUri: HashUri;
  fragment?: string;
};
export type DocumentAnnotationsDb = Opaque<SingleStoreDb<HashUri[]>>;
export type DocumentAnnotationsIndex = (
  q: DocumentAnnotationsQuery
) => Promise<HashUri[]>;

export const createDocumentAnnotationsIndexDb = (): // localStoreDb: LocalStoreDb
Promise<DocumentAnnotationsDb> =>
  openSingleStoreDb("document-annotations-index", undefined) as Promise<
    DocumentAnnotationsDb
  >;

const recordKey = (documentHashUri: HashUri, fragment?: string) =>
  fragment ? `${documentHashUri}:${fragment}` : documentHashUri;

export const createDocumentAnnotationsIndex = (
  annotationDb: DocumentAnnotationsDb
): DocumentAnnotationsIndex => async ({ documentHashUri, fragment }) =>
  storeGet<HashUri[]>(annotationDb, recordKey(documentHashUri, fragment)).then(
    (annotations = [] as HashUri[]) => annotations
  );

export const createDocumentAnnotationsIndexer = (
  annotationDb: DocumentAnnotationsDb
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
    console.log("indexing annotation", annotation, key);

    const documentAnnotations = await storeGet<HashUri[]>(annotationDb, key);

    if (documentAnnotations) {
      await storePut(annotationDb, [...documentAnnotations, ld["@id"]], key);
    } else {
      await storePut(annotationDb, [ld["@id"]], key);
    }
    return;
  };
};
