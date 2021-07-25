import { Processor, Transformer } from "linki";

import { throwIfUndefined } from "../errors";

export const attach = <T, S>(t: Transformer<T, S>): Transformer<T, [T, S]> => (
  v
) => [v, t(v)];

export const throwOnNull = <T>(): Processor<T | undefined, T> => (callback) => (
  v
) => {
  callback(throwIfUndefined(v));
};
