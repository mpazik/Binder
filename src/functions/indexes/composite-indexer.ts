import { Indexer } from "./types";

export const createCompositeIndexer = (indexers: Indexer[]): Indexer => async (
  data
) => {
  await Promise.all(indexers.map((it) => it(data)));
};
