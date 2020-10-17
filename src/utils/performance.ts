export const measureTime = <T>(name: string, fun: () => T): T => {
  console.time(name);
  const result = fun();
  console.timeEnd(name);
  return result;
};

export const measureAsyncTime = async <T>(
  name: string,
  fun: () => Promise<T>
): Promise<T> => {
  console.time(name);
  const result = await fun();
  console.timeEnd(name);
  return result;
};
