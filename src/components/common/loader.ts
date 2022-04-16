import "./loading.css";

import type { Callback } from "linki";
import { defined, filter, fork, link, map, pick } from "linki";
import type { JsonHtml, UiComponent, View } from "linki-ui";
import { button, div, p } from "linki-ui";

import { closable } from "../../libs/linki";
import {
  handleState,
  newStateMachine,
  newStateMapper,
} from "../../libs/named-state";

import { centerLoading } from "./center-loading-component";

type LoaderAction<C, R, V> =
  | ["init", C]
  | ["load", R]
  | ["retry"]
  | ["stop"]
  | ["display", V]
  | ["fail", string];

export type LoaderState<C, R, V> =
  | ["idle", { request?: R; context?: C; data?: V }]
  | ["initializing", { request: R; context: C }]
  | ["ready", { data: V; context: C }]
  | ["loading", { data: V; context: C; request: R }]
  | ["error", { reason: string; request: R; context: C }];

const newLoaderStateMachine = <C, R, V>(
  callback: Callback<LoaderState<C, R, V>>
): Callback<LoaderAction<C, R, V>> =>
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
    {
      stop: () => ["idle", {}],
      init: (context) => ["idle", { context }],
    }
  )(callback);

type ErrorView = View<{ reason: string; retry: () => void }>;

const defaultErrorView: ErrorView = ({ reason, retry }) =>
  div(
    { class: "flash mt-3 flash-error" },
    p(reason),
    button({ class: "btn", onClick: retry }, "Retry")
  );

const loaderView = <C, R, V>({
  contentSlot,
  errorView,
  retry,
}: {
  contentSlot: JsonHtml;
  errorView: ErrorView;
  retry: () => void;
}): View<LoaderState<C, R, V>> =>
  newStateMapper(centerLoading(), {
    ready: () => contentSlot,
    loading: () => [centerLoading(), contentSlot] as JsonHtml,
    error: ({ reason }) =>
      errorView({
        reason,
        retry,
      }),
  });

export const loaderWithContext = <C, R, V>({
  fetcher,
  onLoaded,
  contentSlot,
  errorView = defaultErrorView,
}: {
  fetcher: (context: C, request: R, s: AbortSignal) => Promise<V>;
  onLoaded: Callback<V>;
  contentSlot: JsonHtml;
  errorView?: ErrorView;
}): UiComponent<{ init: C | Promise<C>; load: R; display: V }> => ({
  render,
}) => {
  const handleResponse = (
    promise: Promise<V>,
    signal: AbortSignal
  ): Promise<LoaderAction<C, R, V> | undefined> =>
    promise
      .then((article) => ["display", article] as LoaderAction<C, R, V>)
      .catch((error) => {
        if (signal.aborted) {
          console.info("Request was aborted, ignoring the error", error);
          return;
        }
        console.error(error);
        return ["fail", error.toString()] as LoaderAction<C, R, V>;
      });

  const stateMachine: Callback<LoaderAction<C, R, V>> = newLoaderStateMachine(
    fork(
      link(
        map(
          loaderView({
            contentSlot,
            errorView,
            retry: () => stateMachine(["retry"]),
          })
        ),
        render
      ),
      closable((state, signal) => {
        handleState<LoaderState<C, R, V>>(state, {
          initializing: ({ context, request }) => {
            handleResponse(fetcher(context, request, signal), signal).then(
              link(filter(defined), stateMachine)
            );
          },
          loading: ({ context, request }) => {
            handleResponse(fetcher(context, request, signal), signal).then(
              link(filter(defined), stateMachine)
            );
          },
          ready: link(map(pick("data")), onLoaded),
        });
      })
    )
  );
  return {
    stop: () => stateMachine(["stop"]),
    init: (context) => {
      stateMachine(["stop"]);
      Promise.resolve(context).then((c) => stateMachine(["init", c]));
    },
    load: (request) => stateMachine(["load", request]),
    display: (value) => stateMachine(["display", value]),
  };
};

export const loader = <R, V>({
  fetcher,
  onLoaded,
  errorView = defaultErrorView,
  contentSlot,
}: {
  fetcher: (request: R, s: AbortSignal) => Promise<V>;
  onLoaded: Callback<V>;
  contentSlot: JsonHtml;
  errorView?: ErrorView;
}): UiComponent<{ load: R; display: V }> => ({ render }) => {
  const { load, display, init, stop } = loaderWithContext<{}, R, V>({
    fetcher: (context, request, signal) => fetcher(request, signal),
    onLoaded,
    contentSlot,
    errorView,
  })({ render });
  init({});

  return {
    stop,
    load,
    display,
  };
};
