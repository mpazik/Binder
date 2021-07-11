import { removeItem } from "../../../binder-prototype-gdrive-sync/src/libs/arrays";

// 6 is average number of simultaneous persistent connections per host
// https://stackoverflow.com/questions/985431/max-parallel-http-connections-in-a-browser
export const browserHostConnectionsLimit = 6;

export const asyncPool = async <T, S>(
  array: T[],
  iteratorFn: (a: T) => Promise<S>,
  poolLimit: number = browserHostConnectionsLimit
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

export const asyncLoop = async (
  step: () => Promise<boolean | undefined>
): Promise<void> => {
  let continueLoop = true;
  while (continueLoop) {
    continueLoop = !(await step());
  }
  return;
};
