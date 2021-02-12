import { HashUri } from "../../libs/hash";
import { LinkedDataWithHashId } from "../../libs/linked-data";

export type IndexRecord<T> = { props: T; hash: HashUri };
export type IndexingStrategy<T> = (
  linkedData: LinkedDataWithHashId
) => Promise<T>;
export type Index<Q, T> = (q: Q) => Promise<IndexRecord<T>[]>;

export type Indexer = (ld: LinkedDataWithHashId) => Promise<void>;
