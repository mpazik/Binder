import { throwIfNull, throwIfUndefined } from "../errors";

import { defined, definedTuple, filter } from "./filters";
import { ignore } from "./mappers";
import {
  Callback,
  Consumer,
  OnCloseRegister,
  PartialTuple,
  Tuple,
} from "./types";
import { equal } from "./utils/equal";

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

/*
Side effect free implementation
type WithAbort<T> = [last: AbortController, old: [T, AbortController]];
export const closableCorrect = <T>(
  handler: (v: T, signal: AbortSignal) => void
): Callback<T> =>
  reduce<WithAbort<T>, T>(
    [new AbortController(), (undefined as unknown) as [T, AbortController]],
    ([controller], value) => [new AbortController(), [value, controller]],
    ([lastController, [value, oldController]]) => {
      oldController.abort();
      handler(value, lastController.signal);
    }
  );
  */

export const closable = <T>(
  handler: (v: T, signal: AbortSignal) => void
): Callback<T> =>
  reduce(
    new AbortController(),
    (oldController, value) => {
      oldController.abort(); // side effect
      const newController = new AbortController();
      handler(value, newController.signal); // side effect
      return newController;
    },
    ignore
  );

export const flatten = <T>(push: Callback<T>): Callback<T[]> => (array) =>
  array.forEach(push);

export const reduce = <S, C>(
  initState: S,
  reducer: (state: S, change: C) => S,
  callback: Callback<S>
): Callback<C> => {
  let state: S = initState;
  return (change) => {
    const newState = reducer(state, change);
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

export function splitMap<T, S, Q>(
  isFirst: (v: T | S) => v is T,
  onFirst: (v: T) => Q,
  onSecond: (v: S) => Q,
  callback: Callback<Q>
): Callback<T | S>;

export function splitMap<T, S>(
  predicate: (v: T) => boolean,
  onFirst: (v: T) => S,
  onSecond: (v: T) => S,
  callback: Callback<S>
): Callback<T>;

export function splitMap<T, S>(
  predicate: (v: T) => boolean,
  onFirst: (v: T) => S,
  onSecond: (v: T) => S,
  callback: Callback<S>
): Callback<T> {
  return (value) => {
    callback(predicate(value) ? onFirst(value) : onSecond(value));
  };
}

export const splitOnUndefined = <T>(
  onUndefined: Callback<undefined>,
  onValue: Callback<T>
): Callback<T | undefined> => split(defined, onValue, onUndefined);

export const select = <T, S>(
  selectorExtractor: (v: T) => S,
  callbacks: [S, Callback<T>][],
  defaultCallback: S extends undefined | null ? Callback<T> : never
): Callback<T> => (value) => {
  const selector = selectorExtractor(value);
  console.log(selector, value);
  if (selector) {
    throwIfNull(callbacks.find((it) => it[0] === selector))[1](value);
    return;
  }
  if (!defaultCallback) {
    throw new Error(`Could not find callback for value '${value}'`);
  }
  defaultCallback(value);
};

export const withDefaultValue = <T>(
  defaultValue: T,
  callback: Callback<T>
): Callback<T | undefined | null> => (value) => {
  callback(value ?? defaultValue);
};

export const fork = <T = void>(...consumers: Consumer<T>[]): Consumer<T> => (
  data
) => {
  consumers.forEach((push) => push(data));
};

export const combine = <T extends Tuple>(
  callback: (args: T) => void,
  ...init: PartialTuple<T>
): {
  [K in keyof T]: Callback<T[K]>;
} => combineAlways<T>(filter(definedTuple, callback), ...init);

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

// export const combineAlways2 = <T extends Tuple>(
//   callback: (args: PartialTuple<T>) => void,
//   ...init: PartialTuple<T>
// ): {
//   [K in keyof T]: Callback<T[K]>;
// } => {
//   const update = reduce<unknown[], [n: number, change: unknown]>(
//     init.slice(),
//     (state, [n, change]) => {
//       state[n] = change;
//       return state;
//     },
//     cast(callback)
//   );
//
//   return (init.map((s, n) => (newStateN: unknown) =>
//     update([n, newStateN])
//   ) as unknown) as {
//     [K in keyof T]: Callback<T[K]>;
//   };
// };

export const withState = <S, V = void>(
  callback: (state: S, value: V) => void,
  init?: S
): [
  V extends void ? () => void : (v: V) => void,
  (s: S) => void,
  () => void
] => {
  let state: S | undefined = init;
  return [
    ((v) => {
      callback(throwIfUndefined(state), v);
    }) as V extends void ? () => void : (v: V) => void,
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
  fork((value) => console.log(name, value), callback);

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
