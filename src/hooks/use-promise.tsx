import { useEffect, useState } from "react";

type PromiseState<T> =
  | [result: T, error: undefined, loading: false]
  | [result: undefined, error: Error, loading: false]
  | [result: undefined, error: undefined, loading: true];

export const usePromise = <T extends unknown>(
  promise: () => Promise<T>
): PromiseState<T> => {
  const [promiseState, setPromiseState] = useState<PromiseState<T>>([
    undefined,
    undefined,
    true,
  ]);

  useEffect(() => {
    let canceled = false;
    promise().then(
      (result) => !canceled && setPromiseState([result, undefined, false]),
      (error) => !canceled && setPromiseState([undefined, error, false])
    );

    return () => {
      canceled = true;
    };
  }, [promise]);

  return promiseState;
};
