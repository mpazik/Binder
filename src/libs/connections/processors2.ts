import { throwIfUndefined } from "../errors";

import { OnCloseRegister } from "./types";
import { equal } from "./utils/equal";

export type Callback<T> = (value: T) => void;

type Mapper<T, S> = (v: T) => S;

export const map = <T, S>(
  transform: Mapper<T, S>,
  callback: Callback<S>
): Callback<T> => (v: T) => callback(transform(v));

export const passUndefined = <T, S>(
  map: Mapper<T, S>
): Mapper<T | undefined, S | undefined> => (v) => (v ? map(v) : undefined);

export const closableMap = <T, S>(
  transform: (v: T, onClose: OnCloseRegister) => S,
  callback: Callback<S>
): Callback<T> => {
  let abortController = new AbortController();

  return (v: T) => {
    abortController.abort();
    abortController = new AbortController();
    callback(
      transform(v, (handler) => {
        abortController.signal.addEventListener("abort", handler);
      })
    );
  };
};

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

export const setupContext = <T>(
  initialState?: T
): [
  mapper: (consumer: (v: T) => void) => void,
  set: Callback<T>,
  reset: () => void
] => {
  let state = initialState;
  return [
    (callback) => callback(throwIfUndefined(state)),
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
): (() => void) => () => callback(undefined);

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

export const filterNonNull = <T>(
  callback: Callback<T>
): Callback<T | undefined | null> => (v) => {
  if (v) callback(v);
};

export const withDefaultValue = <T>(
  defaultValue: T,
  callback: Callback<T>
): Callback<T | undefined | null> => (value) => {
  callback(value ?? defaultValue);
};
