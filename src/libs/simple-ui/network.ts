import { OnCloseRegister } from "./connections";

export type Network<T> = (props: T, onClose: OnCloseRegister) => void;

export const resumableNetwork = <T>(
  network: Network<T>,
  onClose: OnCloseRegister
): ((props: T) => void) => {
  let abortController: AbortController | null = null;
  const deactivate = () => abortController?.abort();
  onClose(deactivate);
  return (props: T) => {
    deactivate();
    abortController = new AbortController();
    network(props, (handler) =>
      abortController?.signal.addEventListener("abort", handler)
    );
  };
};
