export type Consumer<T> = (value: T) => void;

export type Handler = () => void;
type HandlerRegister = (closeHandler: Handler) => void;

export type Provider<T> = (onClose: HandlerRegister, push: Consumer<T>) => void;

export type Input<T> = (push: Consumer<T>) => void;
export type Output<T> = (value: T) => void;

export type ProviderFactory<C, T> = (config: C) => Provider<T>;
export type Processor<T, S> = (push: Consumer<S>) => Consumer<T>;

export const dataPortal = <T>(): [input: Input<T>, consumer: Consumer<T>] => {
  let consumer: ((value: T) => void) | undefined;
  return [
    (c) => {
      consumer = c;
    },
    (value) => {
      consumer?.(value);
    },
  ];
};

export const portal = (): [register: HandlerRegister, handler: Handler] => {
  let handler: Handler | undefined;
  return [(h) => (handler = h), () => handler?.()];
};
