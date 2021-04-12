import { Callback, closable, Consumer, fork } from "../../libs/connections";
import { map, pick } from "../../libs/connections/mappers";
import {
  handleState,
  newStateMachine,
  newStateMapper,
} from "../../libs/named-state";
import {
  button,
  ComponentBody,
  div,
  p,
  Prop,
  Slot,
  View,
} from "../../libs/simple-ui/render";

import { centerLoading } from "./center-loading-component";

type LoaderAction<C, R, V extends Prop> =
  | ["init", C]
  | ["load", R]
  | ["retry"]
  | ["stop"]
  | ["display", V]
  | ["fail", string];

export type LoaderState<C, R, V extends Prop> =
  | ["idle", { request?: R; context?: C; data?: V }]
  | ["initializing", { request: R; context: C }]
  | ["ready", { data: V; context: C }]
  | ["loading", { data: V; context: C; request: R }]
  | ["error", { reason: string; request: R; context: C }];

const newLoaderStateMachine = <C, R, V extends Prop>(
  callback: Consumer<LoaderState<C, R, V>>
): Consumer<LoaderAction<C, R, V>> =>
  newStateMachine<LoaderState<C, R, V>, LoaderAction<C, R, V>>(
    ["idle", {}],
    {
      idle: {
        load: (request, { context }) =>
          context
            ? ["initializing", { context, request }]
            : ["idle", { request }],
        display: (data, { context }) =>
          context ? ["ready", { context, data }] : ["idle", { data }],
        init: (context, { request, data }) =>
          data
            ? ["ready", { context, data }]
            : request
            ? ["initializing", { context, request }]
            : ["idle", { context }],
      },
      initializing: {
        load: (request, { context }) => ["initializing", { request, context }],
        display: (data, { context }) => ["ready", { context, data }],
        fail: (reason, { context, request }) => [
          "error",
          { context, reason, request },
        ],
      },
      ready: {
        load: (request, { context, data }) => [
          "loading",
          { context, request, data },
        ],
        display: (data, { context }) => ["ready", { context, data }],
      },
      loading: {
        load: (request, { context, data }) => [
          "loading",
          { context, request, data },
        ],
        display: (data, { context }) => ["ready", { context, data }],
        fail: (reason, { context, request }) => [
          "error",
          { context, request, reason },
        ],
      },
      error: {
        load: (request, { context }) => ["initializing", { context, request }],
        display: (data, { context }) => ["ready", { context, data }],
        retry: (_, { context, request }) => [
          "initializing",
          { context, request },
        ],
      },
    },
    callback,
    {
      stop: () => ["idle", {}],
      init: (context) => ["idle", { context }],
    }
  );

type ErrorView = View<{ reason: string; retry: () => void }>;

const defaultErrorView: ErrorView = ({ reason, retry }) =>
  div(
    { class: "flash mt-3 flash-error" },
    p(reason),
    button({ onClick: retry }, "Retry")
  );

const loaderView = <C, R, V extends Prop>({
  contentSlot,
  errorView,
  retry,
}: {
  contentSlot: Slot;
  errorView: ErrorView;
  retry: () => void;
}): View<LoaderState<C, R, V>> =>
  newStateMapper({
    idle: () => centerLoading(),
    initializing: () => centerLoading(),
    ready: () => div(contentSlot),
    loading: () => div(centerLoading(), contentSlot),
    error: ({ reason }) =>
      errorView({
        reason,
        retry,
      }),
  });

export const loaderWithContext = <C, R, V extends Prop>({
  fetcher,
  onLoaded,
  errorView = defaultErrorView,
  contentSlot,
}: {
  fetcher: (context: C, request: R, s: AbortSignal) => Promise<V>;
  onLoaded: Callback<V>;
  contentSlot: Slot;
  errorView?: ErrorView;
}): ComponentBody<{ init: C | Promise<C>; load: R; display: V }> => (
  render,
  onClose
) => {
  const handleResponse = (
    promise: Promise<V>
  ): Promise<LoaderAction<C, R, V>> =>
    promise
      .then((article) => ["display", article] as LoaderAction<C, R, V>)
      .catch((error) => ["fail", error.toString()] as LoaderAction<C, R, V>);

  const stateMachine: Consumer<LoaderAction<C, R, V>> = newLoaderStateMachine(
    fork(
      map(
        loaderView({
          contentSlot,
          errorView,
          retry: () => stateMachine(["retry"]),
        }),
        render
      ),
      closable((state, signal) => {
        handleState<LoaderState<C, R, V>>(state, {
          initializing: ({ context, request }) => {
            handleResponse(fetcher(context, request, signal)).then(
              stateMachine
            );
          },
          loading: ({ context, request }) => {
            handleResponse(fetcher(context, request, signal)).then(
              stateMachine
            );
          },
          ready: map(pick("data"), onLoaded),
        });
      })
    )
  );
  onClose(() => stateMachine(["stop"]));

  return {
    init: (context) => {
      stateMachine(["stop"]);
      Promise.resolve(context).then((c) => stateMachine(["init", c]));
    },
    load: (request) => stateMachine(["load", request]),
    display: (value) => stateMachine(["display", value]),
  };
};

export const loader = <R, V extends Prop>({
  fetcher,
  onLoaded,
  errorView = defaultErrorView,
  contentSlot,
}: {
  fetcher: (request: R, s: AbortSignal) => Promise<V>;
  onLoaded: Callback<V>;
  contentSlot: Slot;
  errorView?: ErrorView;
}): ComponentBody<{ load: R; display: V }> => (render, onClose) => {
  const { load, display, init } = loaderWithContext<{}, R, V>({
    fetcher: (context, request, signal) => {
      return fetcher(request, signal);
    },
    onLoaded,
    contentSlot,
    errorView,
  })(render, onClose);
  init({});

  return {
    load: load,
    display: display,
  };
};
