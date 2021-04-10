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
export const defined = <T>(v: T | undefined): v is T => v !== undefined;
export const defined2 = <T>() => (v: T | undefined): v is T => v !== undefined;
export const definedProp = <T, K extends keyof T>(key: K) => (
  v: T
): v is T & Required<Pick<T, K>> => defined(v[key]);

export const definedTuple = <T extends Tuple>(
  tuple: PartialTuple<T>
): tuple is T => tuple.every(defined);

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
