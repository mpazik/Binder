import { Processor } from "./connections";
import { Reducer, reducerProcessor } from "./functions";

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

export const newStateMapper = <S extends SomeState, T>(
  mappers: {
    [SK in S[0]]: (state: StateByName<S, SK>[1]) => T;
  }
) => ([key, data]: S): T => mappers[key as S[0]](data);

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
): Reducer<S, A> => (state, action): S => {
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

export const stateMachine = <S extends SomeState, A extends SomeAction>(
  initState: S,
  behaviours: Behaviours<S, A>
): Processor<A, S> => (push) => {
  push(initState);
  return reducerProcessor(newStateMachineHandler(behaviours), initState)(push);
};

type StateFeedbacks<S extends SomeState, A extends SomeAction> = {
  [SK in S[0]]?: (
    state: StateByName<S, SK>[1],
    abortSignal: AbortSignal
  ) => Promise<A>;
};

export const stateMachineWithFeedback = <
  S extends SomeState,
  A extends SomeAction
>(
  initState: S,
  behaviours: Behaviours<S, A>,
  feedbacks: StateFeedbacks<S, A>
): Processor<A, S> => (push) => {
  let abortController = new AbortController();

  const handleAction = stateMachine(
    initState,
    behaviours
  )((state) => {
    abortController.abort();
    abortController = new AbortController();
    const feedback = feedbacks[state[0] as S[0]];
    if (feedback) {
      feedback(state[1], abortController.signal).then((action) =>
        handleAction(action)
      );
    }
    push(state);
  });
  return handleAction;
};
