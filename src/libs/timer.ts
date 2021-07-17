type TimerStopper = () => void;

export type Timer = (millis: number, action: () => void) => TimerStopper;
export type SetupTimer = (action: () => void) => TimerStopper;

export const browserTimer: Timer = (millis, action) => {
  const ref = setTimeout(action, millis);
  return () => clearTimeout(ref);
};

export const setupTimer = (timer: Timer, millis: number): SetupTimer => (
  action
) => timer(millis, action);

type LastTimerExecution = {
  action: () => void;
  stopped: boolean;
};

export const createManualTimer = (): [SetupTimer, () => LastTimerExecution] => {
  let action: () => void,
    stopped = false;
  return [
    (a) => {
      action = a;
      return () => {
        stopped = true;
      };
    },
    () => ({
      action,
      stopped,
    }),
  ];
};
