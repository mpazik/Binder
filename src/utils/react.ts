import { useEffect, useMemo, useState } from "react";

import { portal, Provider } from "./connections";
import { Consumer, Processor } from "./functions";

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
  });

  return state;
};
