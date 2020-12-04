export type Consumer<T> = (value: T) => void;

export type Handler = () => void;
export type HandlerRegister = (closeHandler: Handler) => void;

export type Provider<T> = (signal: AbortSignal, push: Consumer<T>) => void;

export type Input<T> = (push: Consumer<T>) => void;
export type Output<T> = (value: T) => void;

export type ProviderFactory<C, T> = (config: C) => Provider<T>;
export type Processor<T, S> = (push: Consumer<S>) => Consumer<T>;
export type CancelableProcessor<T, S> = (
  signal: AbortSignal,
  push: Consumer<S>
) => Consumer<T>;

export const map = <T, S>(transform: (v: T) => S): Processor<T, S> => (
  push
) => (v: T) => push(transform(v));

export const mapProvider = <T, S>(
  provider: Provider<T>,
  map: (value: T) => S
): Provider<S> => (signal, push) => {
  provider(signal, (data) => push(map(data)));
};

export const mapInput = <T, S>(
  input: Input<T>,
  map: (value: T) => S
): Input<S> => (push) => {
  input((data) => push(map(data)));
};

export const providerMerge = <T>(
  p1: Provider<T>,
  p2: Provider<T>
): Provider<T> => {
  return (signal, push) => {
    p1(signal, push);
    p2(signal, push);
  };
};

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
