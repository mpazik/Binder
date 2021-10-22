import type { Callback, Processor, Transformer } from "linki";
import { filter, fork, link, map } from "linki";

export interface BaseChain<I, T> {
  process: <T2>(processor: Processor<T, T2>) => BaseChain<I, T2>;
  handle: (callback: Callback<T>) => Callback<I>;
}

const newChainBuilder = <I, O>(
  processors: Processor<unknown>[]
): BaseChain<I, O> => {
  return {
    process: (processor) => {
      processors.push(processor as Processor<unknown>);
      return newChainBuilder(processors);
    },
    handle: (handler) => {
      return link<I, O>(...processors, handler);
    },
  };
};

export const baseChain = <I>(): BaseChain<I, I> => {
  return newChainBuilder([]);
};

export const baseChain2 = <T>(
  a: (b: BaseChain<T, T>) => Callback<T>
): Callback<T> => {
  return a(baseChain<T>());
};

export interface Chain<I, T> {
  map: <T2>(f1: Transformer<T, T2>) => Chain<I, T2>;
  filter: (predicate: (v: T) => boolean) => Chain<I, T>;
  withEffect: (chain: (c: Chain<T, T>) => Callback<T>) => Chain<I, T>;
  fork: (...callbacks: Callback<T>[]) => Callback<I>;

  process: <T2>(processor: Processor<T, T2>) => Chain<I, T2>;
  handle: (callback: Callback<T>) => Callback<I>;
}

const effect = <T>(handler: (data: T) => void): Processor<T> => (callback) => (
  data
) => {
  handler(data);
  callback(data);
};

export const buildChain = <I, T>(baseChain: BaseChain<I, T>): Chain<I, T> => {
  return {
    map: (t) => buildChain(baseChain.process(map(t))),
    filter: (t) => buildChain(baseChain.process(filter(t))),
    withEffect: (chainHandler) =>
      buildChain(baseChain.process(effect(startChain(chainHandler)))),
    fork: (t) => baseChain.handle(fork(t)),

    process: (t) => buildChain(baseChain.process(t)),
    handle: (t) => baseChain.handle(t),
  };
};

export const chain = <I>(): Chain<I, I> => buildChain<I, I>(baseChain());

export const startChain = <T>(
  a: (b: Chain<T, T>) => Callback<T>
): Callback<T> => {
  return a(chain<T>());
};
