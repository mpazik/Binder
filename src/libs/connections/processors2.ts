export type Callback<T> = (value: T) => void;

export const map = <T, S>(
  transform: (v: T) => S,
  callback: Callback<S>
): Callback<T> => (v: T) => callback(transform(v));

type Mapper<V> = <T, S>(
  transform: (v: T, state: V | undefined) => S,
  callback: Callback<S>
) => Callback<T>;

export const statefulMap = <V>(): [Mapper<V>, Callback<V>] => {
  let state: V;
  return [
    (transform, callback) => (v) => callback(transform(v, state)),
    (newState: V) => {
      state = newState;
    },
  ];
};

export const forEach = <T>(
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

export const filter = <T>(
  predicate: (v: T) => boolean,
  callback: Callback<T>
): Callback<T> => (v: T) => {
  if (predicate(v)) callback(v);
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
