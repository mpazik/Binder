import { useEffect, useMemo, useState } from "react";

import { Consumer, portal, Processor, Provider } from "./connections";

export const useProcessor = <T, S>(
  processor: Processor<T, S>,
  initResult: S
): [S, Consumer<T>] => {
  const [state, setState] = useState<S>(initResult);
  const setAction = useMemo<Consumer<T>>(() => processor(setState), [
    processor,
  ]);
  return [state, setAction];
};

export const useProvider = <T>(provider: Provider<T>, initialState: T): T => {
  const [state, setState] = useState<T>(initialState);

  useEffect(() => {
    const [register, handler] = portal();
    provider(register, (data) => {
      setState(data);
    });
    return handler;
  }, [provider]);

  return state;
};
