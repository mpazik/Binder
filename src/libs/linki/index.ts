import {
  Callbacks,
  PartialTuple,
  Processor,
  ProcessorMultiIn,
  Transformer,
  Tuple,
} from "linki";

import { throwIfUndefined } from "../errors";

export const attach = <T, S>(t: Transformer<T, S>): Transformer<T, [T, S]> => (
  v
) => [v, t(v)];

export const throwOnNull = <T>(): Processor<T | undefined, T> => (callback) => (
  v
) => {
  callback(throwIfUndefined(v));
};

export const combine = <S extends Tuple>(
  ...init: PartialTuple<S>
): ProcessorMultiIn<S, PartialTuple<S>> => (callback) => {
  const state = init.slice(0);

  return (init.map((s, n) => (newStateN: unknown) => {
    state[n] = newStateN;
    callback((state as unknown) as PartialTuple<S>);
  }) as unknown) as Callbacks<S>;
};
