import { throwIfUndefined } from "../errors";

import { equal } from "./utils/equal";

export type Callback<T> = (value: T) => void;

type Mapper<T, S> = (v: T) => S;

export const map = <T, S>(
  transform: Mapper<T, S>,
  callback: Callback<S>
): Callback<T> => (v: T) => callback(transform(v));

export const mapAwait = <T, S>(
  transform: Mapper<T, Promise<S>>,
  callback: Callback<S>,
  onError: Callback<unknown>
): Callback<T> => (v: T) => transform(v).then(callback).catch(onError);

export const toUndefined = <T, S>(
  map: Mapper<T, S>
): Mapper<T | undefined, S | undefined> => (v) => (v ? map(v) : undefined);

export const head = <H, T extends unknown[]>(array: readonly [H, ...T]): H =>
  array[0];

export const tail = <T extends unknown[]>(
  array: readonly [unknown, ...T]
): T => {
  // eslint-disable-next-line unused-imports/no-unused-vars-ts,@typescript-eslint/no-unused-vars
  const [head, ...tail] = array;
  return tail;
};

export const pluck = <T extends object, K extends keyof T>(
  key: K,
  callback: Callback<T[K]>
): Callback<T> => (v) => callback(v[key]);

type StatefulMapper<V> = <T, S>(
  transform: (v: T, state: V) => S,
  callback: Callback<S>
) => Callback<T>;

export const statefulMap = <T>(
  initialState?: T
): [mapper: StatefulMapper<T>, set: Callback<T>, reset: () => void] => {
  let state = initialState;
  return [
    (transform, callback) => (v) =>
      callback(transform(v, throwIfUndefined(state))),
    (newState) => {
      state = newState;
    },
    () => {
      state = undefined;
    },
  ];
};

export const mapTo = <T>(
  value: T,
  callback: Callback<T>
): Callback<unknown> => () => callback(value);

export const withValue = <T>(
  value: T,
  callback: Callback<T>
): (() => void) => () => callback(value);

export const mapToUndefined = (
  callback: Callback<undefined>
): Callback<unknown> => () => callback(undefined);

export const ignoreParam = (
  callback: Callback<void>
): Callback<unknown> => () => callback();

/**
 * Passes only changed element, with one state being delayed.
 * It is use full for delayed hide operation
 */
export const delayedState = <S, T extends S>(
  stateToDelay: T,
  delay: number,
  callback: Callback<S>,
  comparator: (a: S, b: S) => boolean = equal
): Callback<S> => {
  let lastValue: S;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (value: S) => {
    if (comparator(value, stateToDelay)) {
      if (!timeout) {
        timeout = setTimeout(() => {
          timeout = null;
          lastValue = stateToDelay;
          callback(stateToDelay);
        }, delay);
      }
    } else {
      if (comparator(value, lastValue)) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        return;
      }
      lastValue = value;
      callback(value);
    }
  };
};

export const closableForEach = <T>(
  handler: (v: T, signal: AbortSignal) => void,
  callback: Callback<T>
): Callback<T> => {
  let abortController = new AbortController();

  return (v: T) => {
    abortController.abort();
    abortController = new AbortController();
    handler(v, abortController.signal);
    callback(v);
  };
};

export const splitOnUndefined = <T>(
  onUndefined: Callback<undefined>,
  onValue: Callback<T>
): Callback<T | undefined> => (value) => {
  value ? onValue(value) : onUndefined(undefined);
};

export const filter = <T>(
  predicate: (v: T) => boolean,
  callback: Callback<T>
): Callback<T> => (v: T) => {
  if (predicate(v)) callback(v);
};

export const not = <T>(predicate: (v: T) => boolean) => (v: T): boolean =>
  !predicate(v);

export const and = <T>(...predicates: ((v: T) => boolean)[]) => (
  v: T
): boolean => predicates.every((p) => p(v));

export const or = <T>(...predicates: ((v: T) => boolean)[]) => (
  v: T
): boolean => predicates.some((p) => p(v));

export const flatten = <T>(push: Callback<T>): Callback<T[]> => (array) =>
  array.forEach(push);

export const reducer = <S, C>(
  initState: S,
  reduce: (state: S, change: C) => S,
  callback: Callback<S>
): Callback<C> => {
  let state: S = initState;
  return (change) => {
    const newState = reduce(state, change);
    state = newState;
    callback(newState);
  };
};

export const withDefaultValue = <T>(
  defaultValue: T,
  callback: Callback<T>
): Callback<T | undefined | null> => (value) => {
  callback(value ?? defaultValue);
};

export const filterNonNull = <T>(
  callback: Callback<T>
): Callback<T | undefined | null> => (v) => {
  if (v) callback(v);
};

export const filterNonNullProp = <T extends object, K extends keyof T>(
  key: K,
  callback: Callback<T & Required<Pick<T, K>>>
): Callback<T> => (v) => {
  if (v[key]) callback(v as T & Required<Pick<T, K>>);
};

type PartialTuple<T> = {
  [K in keyof T]: T[K] | undefined;
};

export const filterNonNullTuple = <T extends readonly unknown[]>(
  callback: Callback<T>
): Callback<PartialTuple<T>> => (tuple) => {
  if (tuple.every((it) => it !== undefined)) {
    callback((tuple as unknown) as T);
  }
};

export const combine = <T extends readonly unknown[]>(
  callback: (args: T) => void,
  ...init: PartialTuple<T>
): {
  [K in keyof T]: Callback<T[K]>;
} => combineAlways(filterNonNullTuple(callback), ...init);

export const combineAlways = <T extends readonly unknown[]>(
  callback: (args: PartialTuple<T>) => void,
  ...init: PartialTuple<T>
): {
  [K in keyof T]: Callback<T[K]>;
} => {
  const state = init.slice(0);

  return (init.map((s, n) => {
    return (newStateN: unknown) => {
      state[n] = newStateN;
      callback((state as unknown) as T);
    };
  }) as unknown) as {
    [K in keyof T]: Callback<T[K]>;
  };
};

export const withState = <S, V = void>(
  callback: (state: S, value: V) => void,
  init?: S
): [(v: V) => void, (s: S) => void, () => void] => {
  let state: S | undefined = init;
  return [
    (v) => {
      if (state) {
        callback(state, v);
      }
    },
    (s) => {
      state = s;
    },
    () => {
      state = undefined;
    },
  ];
};
