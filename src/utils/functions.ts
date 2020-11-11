export type Reducer<S, A> = (state: S, action: A) => S;

export type Consumer<T> = (value: T) => void;
export type Processor<T, S> = (push: Consumer<S>) => Consumer<T>;

export type Reduce<T, S> = (val: T) => S;

export const createReducer = <S, A>(
  reducer: Reducer<S, A>,
  initState: S
): Reduce<A, S> => {
  let state: S = initState;
  return (change) => {
    state = reducer(state, change);
    return state;
  };
};

export const reducerProcessor = <S, A>(
  reducer: Reducer<S, A>,
  initState: S
): Processor<A, S> => (push) => {
  const reduce = createReducer(reducer, initState);
  return (value) => push(reduce(value));
};
