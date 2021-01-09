import { removeItem } from "../../../binder-prototype-gdrive-sync/src/libs/arrays";

export const asyncPool = async <T, S>(
  poolLimit: number,
  array: T[],
  iteratorFn: (a: T) => Promise<S>
): Promise<S[]> => {
  const returned: Promise<S>[] = [];
  const executing: Promise<void>[] = [];
  for (const item of array) {
    const promise = Promise.resolve().then(() => iteratorFn(item));
    returned.push(promise);

    const current = promise.then(() => {
      removeItem(executing, current);
    });
    executing.push(current);
    if (executing.length >= poolLimit) {
      // block execution until one of the executing promises is resolved
      await Promise.race(executing);
    }
  }
  return Promise.all(returned);
};
