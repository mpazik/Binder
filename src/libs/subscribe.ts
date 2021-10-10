import { Callback } from "linki";

export const createQueue = <T>(): [
  push: (value: T) => void,
  pull: () => Promise<T>,
  size: () => number
] => {
  const queue: T[] = [];
  let promise: Promise<T> | undefined;
  let resolvePromise: ((v: T) => void) | undefined;
  return [
    (data: T) => {
      if (resolvePromise) {
        resolvePromise(data);
        resolvePromise = undefined;
        promise = undefined;
        return;
      }
      queue.push(data);
    },
    () => {
      if (queue.length > 0) {
        const result = queue.shift()!;
        return Promise.resolve(result);
      }
      if (!promise) {
        promise = new Promise((resolve) => {
          resolvePromise = resolve;
        });
      }
      return promise;
    },
    () => queue.length,
  ];
};

export const nextTick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

export type ErrorHandler = (reason: unknown) => void;

/**
 * Manually controlled promise. Useful for tests. Avoid using it on production.
 * Returns a promise so resolve and reject handler could assign
 */
export const manualPromise = <T>(): Promise<
  [Promise<T>, Callback<T>, ErrorHandler]
> => {
  let resolveManual: Callback<T>;
  let rejectManual: ErrorHandler;

  const promise = new Promise<T>((resolve, reject) => {
    resolveManual = resolve;
    rejectManual = reject;
  });
  return nextTick().then(
    () =>
      [promise, resolveManual, rejectManual] as [
        Promise<T>,
        Callback<T>,
        ErrorHandler
      ]
  );
};
