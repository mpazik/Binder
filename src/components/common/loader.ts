import { Callback, closable, Consumer, fork } from "../../libs/connections";
import { map } from "../../libs/connections/mappers";
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

import { centerLoadingSlot } from "./center-loading-component";

type LoaderAction<T, S> =
  | ["load", T]
  | ["retry"]
  | ["stop"]
  | ["display", S]
  | ["fail", string];

export type LoaderState<T extends Prop, S extends Prop> =
  | ["idle"]
  | ["initializing", T]
  | ["ready", S]
  | ["loading", { data: S; request: T }]
  | ["error", { reason: string; request: T }];

const newLoaderStateMachine = <T extends Prop, S extends Prop>(
  callback: Consumer<LoaderState<T, S>>
): Consumer<LoaderAction<T, S>> =>
  newStateMachine<LoaderState<T, S>, LoaderAction<T, S>>(
    ["idle"],
    {
      idle: {
        load: (request) => ["initializing", request],
      },
      initializing: {
        load: (request) => ["initializing", request],
        fail: (reason, request) => ["error", { reason, request }],
      },
      ready: {
        load: (request, data) => ["loading", { data, request }],
      },
      loading: {
        load: (request, { data }) => ["loading", { data, request }],
        fail: (reason, { request }) => ["error", { reason, request }],
      },
      error: {
        load: (url) => ["initializing", url],
        retry: (_, { request }) => ["initializing", request],
      },
    },
    callback,
    {
      display: (data) => ["ready", data],
      stop: () => ["idle"],
    }
  );

type ErrorView = View<{ reason: string; retry: () => void }>;

const defaultErrorView: ErrorView = ({ reason, retry }) =>
  div(
    { class: "flash mt-3 flash-error" },
    p(reason),
    button({ onClick: retry }, "Retry")
  );

const loaderView = <T extends Prop, S extends Prop>({
  contentSlot,
  errorView,
  retry,
}: {
  contentSlot: Slot;
  errorView: ErrorView;
  retry: () => void;
}): View<LoaderState<T, S>> =>
  newStateMapper({
    idle: () => div(centerLoadingSlot()),
    initializing: () => div(centerLoadingSlot()),
    loading: () => div(centerLoadingSlot(), contentSlot),
    ready: () => div(contentSlot),
    error: ({ reason }) =>
      errorView({
        reason,
        retry,
      }),
  });

export const loader = <T extends Prop, S extends Prop>({
  fetcher,
  onLoaded,
  errorView = defaultErrorView,
  contentSlot,
}: {
  fetcher: (r: T, s: AbortSignal) => Promise<S>;
  onLoaded: Callback<S>;
  contentSlot: Slot;
  errorView?: ErrorView;
}): ComponentBody<{ load: T; display: S }> => (render, onClose) => {
  const fetchContent = (
    request: T,
    signal: AbortSignal
  ): Promise<LoaderAction<T, S>> =>
    fetcher(request, signal)
      .then((article) => ["display", article] as LoaderAction<T, S>)
      .catch((error) => ["fail", error.toString()] as LoaderAction<T, S>);

  const stateMachine: Consumer<LoaderAction<T, S>> = newLoaderStateMachine(
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
        handleState<LoaderState<T, S>>(state, {
          initializing: (request) => {
            fetchContent(request, signal).then(stateMachine);
          },
          loading: ({ request }) => {
            fetchContent(request, signal).then(stateMachine);
          },
          ready: onLoaded,
        });
      })
    )
  );
  onClose(() => stateMachine(["stop"]));

  return {
    load: map((r: T) => ["load", r] as LoaderAction<T, S>, stateMachine),
    display: map(
      (data: S) => ["display", data] as LoaderAction<T, S>,
      stateMachine
    ),
  };
};
