export type WaitForOptions = {
  timeout?: number;
  interval?: number;
};

/**
 * Poll a function until it stops throwing. Re-throws the last error on timeout.
 * The function can contain `expect()` calls or any logic that throws on failure.
 */
export const waitFor = async (
  fn: () => Promise<void> | void,
  opts?: WaitForOptions,
): Promise<void> => {
  const timeout = opts?.timeout ?? 5000;
  const interval = opts?.interval ?? 100;
  const deadline = Date.now() + timeout;

  while (true) {
    // eslint-disable-next-line no-restricted-syntax
    try {
      await fn();
      return;
    } catch (err) {
      // eslint-disable-next-line no-restricted-syntax
      if (Date.now() + interval > deadline) throw err;
      await new Promise((r) => setTimeout(r, interval));
    }
  }
};
