import { UpdateIndex } from "./types";

export const createCompositeIndexer = (
  indexers: UpdateIndex[]
): UpdateIndex => async (data) => {
  await Promise.all(indexers.map((it) => it(data)));
};
