export type Consumer<T> = (value: T) => void;
export type CloseHandler = () => void;
export type OnCloseRegister = (handler: CloseHandler) => void;
export type Provider<T> = (push: Consumer<T>) => void;

export type ClosableProvider<T> = (
  onClose: OnCloseRegister,
  push: Consumer<T>
) => void;

export type ProviderSetup<C, T> = (config: C) => ClosableProvider<T>;

export type Processor<T, S> = (push: Consumer<S>) => Consumer<T>;
export type Merge<T, S, W> = (push: Consumer<W>) => [Consumer<T>, Consumer<S>];

export type ClosableProcessor<T, S> = (
  onClose: OnCloseRegister,
  push: Consumer<S>
) => Consumer<T>;

export type BiProcessor<T1, T2, S1, S2> = (
  a: [Consumer<S1>, Consumer<S2>]
) => [Consumer<T1>, Consumer<T2>];
