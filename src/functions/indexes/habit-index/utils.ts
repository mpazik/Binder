export const getMinMaxString = (
  array: [string, ...string[]]
): [min: string, max: string] => {
  let min = array[0];
  let max = array[0];
  for (const string of array) {
    if (string < min) min = string;
    if (string > max) max = string;
  }
  return [min, max];
};
