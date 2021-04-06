import { nonUndefined } from "./filters";
import { Callback } from "./types";

type Function<T, S> = (v: T) => S;
export const identity = <T>(v: T): T => v;

// eslint-disable-next-line unused-imports/no-unused-vars-ts,@typescript-eslint/no-unused-vars
export const ignore = (v: unknown): void => {
  // do nothing
};

export const head = <H, T extends unknown[]>(array: readonly [H, ...T]): H =>
  array[0];

export const tail = <T extends unknown[]>(
  array: readonly [unknown, ...T]
): T => {
  // eslint-disable-next-line unused-imports/no-unused-vars-ts,@typescript-eslint/no-unused-vars
  const [, ...tail] = array;
  return tail;
};

export const pick = <T extends object, K extends keyof T>(
  key: K
): Function<T, T[K]> => (v) => v[key];

export const extend = <T, S>(extend: (v: T) => S): Function<T, [T, S]> => (
  v
) => [v, extend(v)];

export const extendAsync = <T, S>(
  extend: (v: T) => Promise<S>
): Function<T, Promise<[T, S]>> => (v) => extend(v).then((m) => [v, m]);

export const branch = <T1, T2, S>(
  p: (v: T1 | T2) => v is T1,
  map1: Function<T1, S>,
  map2: Function<T2, S>
): Function<T1 | T2, S> => (v) => (p(v) ? map1(v) : map2(v));

export const passUndefined = <T, S>(
  map: Function<T, S>
): Function<T | undefined, S | undefined> =>
  branch(nonUndefined, map, () => undefined);

export function pipe<T, S>(map1: (v: T) => S): Function<T, S>;
export function pipe<T, S, U>(
  map1: (v: T) => S,
  map2: (v: S) => U
): Function<T, U>;
export function pipe<T, S, U, W>(
  map1: (v: T) => S,
  map2: (v: S) => U,
  map3: (v: U) => W
): Function<T, W>;
export function pipe<T, S, U, W, Q>(
  map1: (v: T) => S,
  map2: (v: S) => U,
  map3: (v: U) => W,
  map4: (v: W) => Q
): Function<T, Q>;
export function pipe(
  ...mappers: Function<unknown, unknown>[]
): Function<unknown, unknown> {
  return (v) =>
    mappers.reduce(
      (v, transform: Function<unknown, unknown>) => transform(v),
      v
    );
}

export const toObject = <T>(
  ...keys: (keyof T)[]
): ((values: T[keyof T][]) => T) => (values) =>
  keys.reduce((acc, key, i) => ({ ...acc, [key]: values[i] }), <T>{});

export const wrap = <V, K extends keyof never>(
  key: K
): Function<V, { [A in K]: V }> => (value) =>
  ({ [key]: value } as { [A in K]: V });

export const to = <T>(v: T): ((v: unknown) => T) => (): T => v;

export const map = <T, S>(
  transform: Function<T, S>,
  callback: Callback<S>
): Callback<T> => (v: T) => callback(transform(v));

export const mapAwait = <T, S>(
  transform: Function<T, Promise<S>>,
  callback: Callback<S>,
  onError: Callback<unknown>
): Callback<T> => (v: T) => transform(v).then(callback).catch(onError);

export const cast = <T, S>(callback: Callback<S>): Callback<T> => (v: T) =>
  callback((v as unknown) as S);

export const mapTo = <T>(value: T, callback: Callback<T>): Callback<unknown> =>
  map(to(value), callback);

export const mapToUndefined = (
  callback: Callback<undefined>
): Callback<unknown> => map(to(undefined), callback);

export const withValue = <T>(value: T, callback: Callback<T>): Callback<void> =>
  map(to(value), callback);

export const ignoreParam = (
  callback: Callback<void>
): Callback<unknown> => () => callback();
