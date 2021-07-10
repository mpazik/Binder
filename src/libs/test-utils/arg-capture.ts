export const newArgCapture = <T>(): [
  captureArg: (it: T) => void,
  getCapturedArs: () => T[]
] => {
  let args: T[] = [];
  return [
    (it) => args.push(it),
    () => {
      const lastArgs = args;
      args = [];
      return lastArgs;
    },
  ];
};
