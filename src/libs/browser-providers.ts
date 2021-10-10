import type { ClosableProvider } from "linki";
import { link, map } from "linki";

export const urlHashProvider: ClosableProvider<string> = (push) => {
  const update = () => {
    const hash = location.hash;
    push(hash);
  };
  update();
  window.addEventListener("hashchange", update);
  return () => {
    window.removeEventListener("hashchange", update);
  };
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

export const currentPath = (): string => {
  const path = window.location.pathname;
  return path.startsWith("/") ? path.substring(1) : path;
};

export const browserPathProvider: ClosableProvider<string> = (push) => {
  const update = link(map(currentPath), push);

  window.addEventListener("popstate", update);
  return () => document.removeEventListener("popstate", update);
};
