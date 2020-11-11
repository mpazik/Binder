import { useMemo, useState } from "react";

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
