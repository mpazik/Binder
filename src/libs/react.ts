import { useEffect, useMemo, useState } from "react";

import {
  CancelableProcessor,
  Consumer,
  Processor,
  Provider,
} from "./connections";

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

export const useCancelableProcessor = <T, S>(
  processor: () => CancelableProcessor<T, S>,
  initResult: S
): [S, Consumer<T>] => {
  const controller = useMemo(() => new AbortController(), []);
  const [state, setState] = useState<S>(initResult);
  const setAction = useMemo<Consumer<T>>(() => {
    return processor()(controller.signal, setState);
  }, [processor, controller]);

  useEffect(() => controller.abort, [controller]);

  return [state, setAction];
};

export const useProvider = <T>(provider: Provider<T>, initialState: T): T => {
  const [state, setState] = useState<T>(initialState);

  useEffect(() => {
    const abortController = new AbortController();
    provider(abortController.signal, (data) => {
      setState(data);
    });
    return abortController.abort;
  }, [provider]);

  return state;
};
