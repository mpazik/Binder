import { CreativeWork } from "schema-dts";

import { HashName } from "../../utils/hash";
import { LinkedDataWithItsHash } from "../../utils/linked-data";

export type IndexRecord<T> = { props: T; hash: HashName };
export type IndexingStrategy<T> = (linkedData: CreativeWork) => Promise<T>;
export type Index<Q, T> = (q: Q) => Promise<IndexRecord<T>[]>;

export type Indexer = (ld: LinkedDataWithItsHash) => Promise<void>;
