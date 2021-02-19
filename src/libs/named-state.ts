import { Consumer, Processor, reducer } from "./connections";

export type NamedAction<N, T = void> = T extends void
  ? [name: N]
  : [name: N, data: T];
type SomeAction = NamedAction<string, unknown> | NamedAction<string>;

export type NamedState<N, T = void> = T extends void
  ? [name: N]
  : [name: N, data: T];
type SomeState = NamedState<string, unknown> | NamedState<string>;

type StateByName<S extends SomeState, N extends S[0]> = S extends NamedState<
  N,
  unknown
>
  ? S
  : never;

type ActionByName<A extends SomeAction, N extends A[0]> = A extends NamedAction<
  N,
  unknown
>
  ? A
  : never;

type StatesHandler<S extends SomeState> = {
  [SK in S[0]]?: (state: StateByName<S, SK>[1]) => void;
};

export const newStateHandler = <S extends SomeState>(
  handlers: StatesHandler<S>
) => ([key, data]: S): void => handlers[key as S[0]]?.(data);

export const handleState = <S extends SomeState>(
  [key, data]: S,
  handlers: StatesHandler<S>
) => handlers[key as S[0]]?.(data);

export const newStateMapper = <S extends SomeState, T>(
  mappers: {
    [SK in S[0]]: (state: StateByName<S, SK>[1]) => T;
  }
) => ([key, data]: S): T => mappers[key as S[0]](data);

export const newStateOptionalMapper = <S extends SomeState, T>(
  mappers: {
    [SK in S[0]]?: (state: StateByName<S, SK>[1]) => T;
  }
) => ([key, data]: S): T | undefined => mappers[key as S[0]]?.(data);

export const mapState = <S extends SomeState, T>(
  [key, data]: S,
  mappers: {
    [SK in S[0]]: (state: StateByName<S, SK>[1]) => T;
  }
) => mappers[key as S[0]](data);

type Behaviours<S extends SomeState, A extends SomeAction> = {
  [SK in S[0]]: {
    [AK in A[0]]?: (
      action: ActionByName<A, AK>[1],
      state: StateByName<S, SK>[1]
    ) => S;
  };
};

const newStateMachineHandler = <S extends SomeState, A extends SomeAction>(
  behaviours: Behaviours<S, A>
) => (state: S, action: A): S => {
  const behaviour = behaviours[state[0] as S[0]];
  const handler = behaviour[action[0] as A[0]];
  if (!handler) {
    throw new Error(
      `Synchronizer in sate '${state[0]}' do not expected command '${action[0]}'`
    );
  }
  return handler(
    action[1] as ActionByName<A, A[0]>[1],
    state[1] as StateByName<S, S[0]>[1]
  );
};

export const newStateMachine = <S extends SomeState, A extends SomeAction>(
  initState: S,
  behaviours: Behaviours<S, A>
): Processor<A, S> => reducer(initState, newStateMachineHandler(behaviours));

type StateFeedbacks<S extends SomeState, A extends SomeAction> = {
  [SK in S[0]]?: (
    state: StateByName<S, SK>[1],
    abortSignal: AbortSignal
  ) => Promise<A>;
};

export const newStateMachineWithFeedback = <
  S extends SomeState,
  A extends SomeAction
>(
  initState: S,
  behaviours: Behaviours<S, A>,
  feedbacks: StateFeedbacks<S, A>
): Processor<A, S> => (push) => {
  let abortController = new AbortController();

  const handleState = (state: S) => {
    abortController.abort();
    abortController = new AbortController();
    const feedback = feedbacks[state[0] as S[0]];
    if (feedback) {
      feedback(state[1], abortController.signal).then((action) =>
        handleAction(action)
      );
    }
    push(state);
  };
  const handleAction = newStateMachine(initState, behaviours)(handleState);
  handleState(initState);
  return handleAction;
};

export type StateWithFeedback<S, A> = {
  state: S;
  feedback: Consumer<A>;
};
export const newStateMachineWithFeedback2 = <
  S extends SomeState,
  A extends SomeAction
>(
  initState: S,
  behaviours: Behaviours<S, A>,
  push: Consumer<StateWithFeedback<S, A>>
): Consumer<A> => {
  const handleState = (state: S) => {
    // const feedback = feedbacks[state[0] as S[0]];
    // if (feedback) {
    //   feedback(state[1], abortController.signal).then((action) =>
    //     handleAction(action)
    //   );
    // }
    push({ state, feedback: handleAction });
  };
  const handleAction = newStateMachine(initState, behaviours)(handleState);
  handleState(initState);
  return handleAction;
};
