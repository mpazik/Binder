import { ClosableProvider, link, map, passOnlyChanged } from "linki";

import { linkHijack } from "../functions/url-hijack";

import { fork, Provider } from "./connections";

export const urlHashProvider: Provider<string> = (onClose, push) => {
  const update = () => {
    const hash = location.hash;
    push(hash);
  };
  update();
  window.addEventListener("hashchange", update);
  onClose(() => {
    window.removeEventListener("hashchange", update);
  });
};

export const getQueryParams = (): URLSearchParams =>
  new URLSearchParams(window.location.search);

export const getUriFragment = (): string | undefined =>
  window.location.hash ? window.location.hash.substring(1) : undefined;

export const queryParamProvider: ClosableProvider<{
  queryParams: URLSearchParams;
  fragment?: string;
}> = (push) => {
  const update = () =>
    push({
      queryParams: getQueryParams(),
      fragment: getUriFragment(),
    });

  setImmediate(update);
  window.addEventListener("popstate", update);
  return () => document.removeEventListener("popstate", update);
};

export const browserPathProvider: ClosableProvider<string> = (push) => {
  const update = link(
    map(() => window.location.pathname),
    passOnlyChanged(),
    push
  ) as () => void;

  setImmediate(update);
  window.addEventListener("popstate", update);
  return () => document.removeEventListener("popstate", update);
};

export const pathProvider: ClosableProvider<string> = (push) =>
  fork(
    linkHijack({ predicate: (uri) => uri.startsWith("/") })(
      fork(push, (path) => history.pushState(null, "", path))
    ),
    browserPathProvider(push)
  );
