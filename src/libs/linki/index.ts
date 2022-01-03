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

export const withEffect = <T>(handler: (data: T) => void) => (data: T): T => {
  handler(data);
  return data;
};

export const effect = <T>(handler: (data: T) => void): Processor<T> => (
  callback
) => (data) => {
  handler(data);
  callback(data);
};

export const throwOnNull = <T>(): Processor<T | undefined, T> => (callback) => (
  v
) => {
  callback(throwIfUndefined(v));
};

export const combine = <S extends Tuple>(
  ...init: S
): ProcessorMultiIn<S, S> => (callback) => {
  const state = init;

  return (init.map((s, n) => (newStateN: unknown) => {
    // @ts-ignore
    state[n] = newStateN;
    callback(state);
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
  if (callbackNum < 0) {
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
    if (tuple) {
      const [oldController] = tuple;
      oldController.abort(); // side effect
    }
    const newController = new AbortController();
    return [newController, value];
  }, undefined)((tuple) => {
    if (!tuple) return tuple;
    const [controller, value] = tuple;
    handler(value, controller.signal); // side effect
  });

export const match = <T, S>(
  entries: readonly (readonly [T, S])[]
): Transformer<T, S | undefined> => {
  const map = new Map(entries);
  return (v: T) => map.get(v);
};

export const withMultiState = <S extends Tuple, V = void>(
  ...init: PartialTuple<S>
): ProcessorMultiIn<[V, ...S], [...PartialTuple<S>, V]> => (callback) => {
  const state = init.slice(0);

  return [
    ((v) => {
      callback([...((state as unknown) as PartialTuple<S>), v]);
    }) as Callback<V>,
    ...(((init.map((s, n) => {
      return (newStateN: unknown) => {
        state[n] = newStateN;
      };
    }) as unknown) as {
      [K in keyof S]: Callback<S[K]>;
    }) as Callbacks<S>),
  ];
};
