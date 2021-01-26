export const throttle = (
  callback: () => void,
  throttle: number
): (() => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let nextQueued = false;

  const trigger = () => {
    if (timeout) {
      nextQueued = true;
      return;
    }

    nextQueued = false;
    callback();
    timeout = setTimeout(() => {
      timeout = null;
      if (nextQueued) {
        trigger();
      }
    }, throttle);
  };
  return trigger;
};

export const throttleArg = <T>(
  callback: (arg: T) => void,
  throttle: number
): ((arg: T) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let nextQueued = false;
  let argQueued: T;

  const trigger = (arg: T) => {
    if (timeout) {
      argQueued = arg;
      nextQueued = true;
      return;
    }

    nextQueued = false;
    callback(arg);
    timeout = setTimeout(() => {
      timeout = null;
      if (nextQueued) {
        trigger(argQueued);
      }
    }, throttle);
  };
  return trigger;
};
