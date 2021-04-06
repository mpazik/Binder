import { Callback, PartialTuple, Tuple } from "./types";

export const not = <T>(predicate: (v: T) => boolean) => (v: T): boolean =>
  !predicate(v);

export const and = <T>(...predicates: ((v: T) => boolean)[]) => (
  v: T
): boolean => predicates.every((p) => p(v));

export const or = <T>(...predicates: ((v: T) => boolean)[]) => (
  v: T
): boolean => predicates.some((p) => p(v));

export const nonNull = <T>(v: T | undefined | null): v is T => Boolean(v);
export const nonUndefined = <T>(v: T | undefined): v is T => Boolean(v);
export const nonUndefined2 = <T>() => (v: T | undefined): v is T => Boolean(v);
export const nonNullProp = <T, K extends keyof T>(key: K) => (
  v: T
): v is T & Required<Pick<T, K>> => nonNull(v[key]);

export const nonNullTuple = <T extends Tuple>(
  tuple: PartialTuple<T>
): tuple is T => tuple.every(nonNull);

export function filter<T, S extends T>(
  predicate: (v: T) => v is S,
  callback: Callback<S>
): Callback<T>;

export function filter<T>(
  predicate: (v: T) => boolean,
  callback: Callback<T>
): Callback<T>;

export function filter<T>(
  predicate: (v: T) => boolean,
  callback: Callback<T>
): Callback<T> {
  return (v) => {
    if (predicate(v)) callback(v);
  };
}

export const filterNonNull = <T>(
  callback: Callback<T>
): Callback<T | undefined | null> => filter(nonNull, callback);

export const filterNonNullProp = <T extends object, K extends keyof T>(
  key: K,
  callback: Callback<T & Required<Pick<T, K>>>
): Callback<T> => filter(nonNullProp(key), callback);

export const filterNonNullTuple = <T extends Tuple>(
  callback: Callback<T>
): Callback<PartialTuple<T>> => filter(nonNullTuple, callback);
