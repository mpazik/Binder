export const firstOf = <T>(array: T[]): T => array[0];
export const lastOf = <T>(array: T[]): T => array[array.length - 1];

export const splitArray = <T>(
  array: T[],
  predicate: (item: T) => boolean
): [T[], T[]] => {
  const trueArray: T[] = [];
  const falseArray: T[] = [];
  for (const item of array) {
    if (predicate(item)) {
      trueArray.push(item);
    } else {
      falseArray.push(item);
    }
  }
  return [trueArray, falseArray];
};

export const filterUndefined = <T>(array: (T | undefined)[]): T[] =>
  array.filter((it) => it !== undefined) as T[];
