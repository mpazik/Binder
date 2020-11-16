import React from "react";

import { usePromise } from "../../hooks/use-promise";

type Props<T extends unknown> = {
  promise: () => Promise<T>;
  children: (data: T) => React.ReactElement;
};

export const AsyncLoader = <T extends unknown>({
  promise,
  children,
}: Props<T>): React.ReactElement => {
  const [result, error, loading] = usePromise(promise);

  if (error) {
    console.error(error);
    return (
      <div>
        <h1>Error</h1>
        <p>{JSON.stringify(error)}</p>
      </div>
    );
  }
  if (loading || !result) {
    return <span>Loading...</span>;
  }

  return children(result);
};
