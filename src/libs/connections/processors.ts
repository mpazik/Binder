import { filterNonNullTuple, nonUndefined } from "./filters";
import {
  Callback,
  Consumer,
  OnCloseRegister,
  PartialTuple,
  Tuple,
} from "./types";
import { equal } from "./utils/equal";
import { throwIfUndefined } from "../errors";

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

export const forEach = <T>(
  handler: (v: T) => void,
  callback: Callback<T>
): Callback<T> => (v: T) => {
  handler(v);
  callback(v);
};

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

export function split<T, S>(
  isFirst: (v: T | S) => v is T,
  onFirst: Callback<T>,
  onSecond: Callback<S>
): Callback<T | S>;

export function split<T>(
  predicate: (v: T) => boolean,
  onFirst: Callback<T>,
  onSecond: Callback<T>
): Callback<T>;

export function split<T>(
  predicate: (v: T) => boolean,
  onFirst: Callback<T>,
  onSecond: Callback<T>
): Callback<T> {
  return (value) => {
    predicate(value) ? onFirst(value) : onSecond(value);
  };
}
export const splitOnUndefined = <T>(
  onUndefined: Callback<undefined>,
  onValue: Callback<T>
): Callback<T | undefined> => split(nonUndefined, onValue, onUndefined);

export const withDefaultValue = <T>(
  defaultValue: T,
  callback: Callback<T>
): Callback<T | undefined | null> => (value) => {
  callback(value ?? defaultValue);
};

export const fork = <T>(...consumers: Consumer<T>[]): Consumer<T> => (data) => {
  consumers.forEach((push) => push(data));
};

export const combine = <T extends readonly unknown[]>(
  callback: (args: T) => void,
  ...init: PartialTuple<T>
): {
  [K in keyof T]: Callback<T[K]>;
} => combineAlways(filterNonNullTuple(callback), ...init);

export const combineAlways = <T extends Tuple>(
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
      callback(throwIfUndefined(state), v);
    },
    (s) => {
      state = s;
    },
    () => {
      state = undefined;
    },
  ];
};

export const withMultiState = <S extends Tuple, V = void>(
  callback: (state: PartialTuple<S>, value: V) => void,
  ...init: PartialTuple<S>
): [
  (v: V) => void,
  {
    [K in keyof S]: Callback<S[K]>;
  }
] => {
  const state = init.slice(0);

  return [
    (v) => {
      callback((state as unknown) as PartialTuple<S>, v);
    },
    (init.map((s, n) => {
      return (newStateN: unknown) => {
        state[n] = newStateN;
      };
    }) as unknown) as {
      [K in keyof S]: Callback<S[K]>;
    },
  ];
};

export const log = <T>(name: string, callback: Callback<T>): Callback<T> =>
  forEach((value) => console.log(name, value), callback);

export const onAnimationFrame = <T>(
  onClose: OnCloseRegister,
  push: Callback<T>
): Callback<T> => {
  let lastValue: T | null = null;
  let frameRequest: null | ReturnType<typeof window.requestAnimationFrame>;

  const scheduleRender = () => {
    if (frameRequest) return;
    frameRequest = window.requestAnimationFrame(() => {
      push(lastValue!);
      frameRequest = null;
    });
  };

  onClose(() => {
    if (frameRequest == null) return;
    window.cancelAnimationFrame(frameRequest);
  });

  return (value) => {
    lastValue = value;
    scheduleRender();
  };
};

export const passOnlyChanged = <T>(push: Callback<T>): Callback<T> => {
  let lastValue: T;
  return (value) => {
    if (equal(value, lastValue)) return;
    lastValue = value;
    push(value);
  };
};

export const match = <T, S>(
  map: Map<T, S>,
  callback: Callback<S>
): Callback<T> => (v: T) => {
  const newV = map.get(v);
  if (newV) callback(newV!);
};
