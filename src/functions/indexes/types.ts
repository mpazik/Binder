import type { HashUri } from "../../libs/hash";
import type { LinkedDataWithHashId } from "../../libs/jsonld-format";

export type IndexRecord<T> = { props: T; hash: HashUri };
export type IndexingStrategy<T> = (
  linkedData: LinkedDataWithHashId
) => Promise<T>;

export type SearchIndex<Q, T> = (q: Q) => Promise<IndexRecord<T>[]>;
export type UpdateIndex = (ld: LinkedDataWithHashId) => Promise<void>;
export type Indexer<T> = (
  ld: LinkedDataWithHashId
) => { props: T; key: string } | undefined;

export type Index<Q, T> = {
  search: SearchIndex<Q, T>;
  update: UpdateIndex;
};
