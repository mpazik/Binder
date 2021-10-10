import type {
  Callback,
  Callbacks,
  PartialTuple,
  Processor,
  ProcessorMultiIn,
  Transformer,
  Tuple,
} from "linki";
import { defined, reduce } from "linki";
import type { ProcessorMultiOut } from "linki/dist/processors/processor";

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

export const clearableDelay = <T>(
  delay: number
): ProcessorMultiIn<[T, void], T> => (callback) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return [
    (value: T) => {
      timeout = setTimeout(() => {
        timeout = null;
        callback(value);
      }, delay);
    },
    () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    },
  ];
};

export const splitDefined = <T>(): ProcessorMultiOut<
  T | undefined,
  [T, undefined]
> => ([onFirst, onSecond]) => (value) => {
  defined(value) ? onFirst(value) : onSecond(value);
};

export const select = <T>(
  extractor: (i: T) => number
): ProcessorMultiOut<T, T[]> => (callbacks) => (value) => {
  const callbackNum = extractor(value);
  if (!callbackNum) {
    throw new Error(`Could not find callback for value '${value}'`);
  }
  const callback = callbacks[callbackNum];
  if (!callback) {
    throw new Error(`Could not find callback for value '${value}'`);
  }
  callback(value);
};

export const indexOf = <T>(table: T[]) => (value: T): number =>
  table.indexOf(value);

export const closable = <T>(
  handler: (v: T, signal: AbortSignal) => void
): Callback<T> =>
  reduce<[AbortController, T] | undefined, T>((tuple, value) => {
    if (!tuple) return tuple;
    const [oldController] = tuple;
    oldController.abort(); // side effect
    const newController = new AbortController();
    return [newController, value];
  }, undefined)((tuple) => {
    if (!tuple) return tuple;
    const [controller, value] = tuple;
    handler(value, controller.signal); // side effect
  });
