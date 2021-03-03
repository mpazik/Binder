import { HashUri } from "../../libs/hash";
import {
  openSingleStoreDb,
  SingleStoreDb,
  storeGet,
  storePut,
} from "../../libs/indexeddb";
import { Opaque } from "../../libs/types";

import { Indexer } from "./types";
import { isTypeEqualTo } from "../../libs/linked-data";

export type Url = string;
export type DocumentAnnotationsQuery = { documentHashUri: HashUri };
export type DocumentAnnotationsDb = Opaque<SingleStoreDb<HashUri[]>>;
export type DocumentAnnotationsIndex = (
  q: DocumentAnnotationsQuery
) => Promise<HashUri[]>;

export const createDocumentAnnotationsIndexDb = (): // localStoreDb: LocalStoreDb
Promise<DocumentAnnotationsDb> =>
  openSingleStoreDb("document-annotations-index", undefined) as Promise<
    DocumentAnnotationsDb
  >;

export const createDocumentAnnotationsIndex = (
  annotationDb: DocumentAnnotationsDb
): DocumentAnnotationsIndex => async ({ documentHashUri }) =>
  storeGet<HashUri[]>(annotationDb, documentHashUri).then(
    (annotations = [] as HashUri[]) => annotations
  );

export const createDocumentAnnotationsIndexer = (
  annotationDb: DocumentAnnotationsDb
): Indexer => {
  return async (ld) => {
    if (!isTypeEqualTo(ld, "annotation")) return;
    const target = ld.target;
    if (!target || typeof target !== "object") return;
    const source = (target as Record<string, unknown>)["source"] as
      | HashUri
      | undefined;
    if (!source) return;

    const documentAnnotations = await storeGet<HashUri[]>(annotationDb, source);

    if (documentAnnotations) {
      await storePut(annotationDb, [...documentAnnotations, ld["@id"]], source);
    } else {
      await storePut(annotationDb, [ld["@id"]], source);
    }
    return;
  };
};
