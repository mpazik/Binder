import { Transformer } from "linki";

export const attach = <T, S>(t: Transformer<T, S>): Transformer<T, [T, S]> => (
  v
) => [v, t(v)];
