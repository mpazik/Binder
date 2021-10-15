import type { ClosableProvider } from "linki";
import { link, map } from "linki";

import { hostPageUri, isHostPageUri } from "../components/app/special-uris";
import { isAbsoluteUrl } from "../components/common/link";

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

export const currentPath = (): string => {
  const path = window.location.pathname;
  return path.startsWith("/") ? path.substring(1) : path;
};

export const currentFragment = (): string | undefined =>
  window.location.hash ? window.location.hash.substring(1) : undefined;

export type UriWithFragment = {
  uri: string;
  fragment?: string;
};

export const currentUriWithFragment = (): UriWithFragment => {
  const path = currentPath();
  return {
    uri: isAbsoluteUrl(path) ? path : hostPageUri(path),
    fragment: currentFragment(),
  };
};

export const updateFragment = (fragment: string): void => {
  window.location.hash = fragment;
};

export const combineToUri = ({ uri, fragment }: UriWithFragment): string =>
  fragment ? `${uri}#${fragment}` : uri;

export const queryParamProvider: ClosableProvider<{
  queryParams: URLSearchParams;
  fragment?: string;
}> = (push) => {
  const update = () =>
    push({
      queryParams: getQueryParams(),
      fragment: currentFragment(),
    });

  setImmediate(update);
  window.addEventListener("popstate", update);
  return () => document.removeEventListener("popstate", update);
};

export const updateBrowserHistory = ({
  uri = currentPath(),
  fragment,
}: UriWithFragment | { fragment: string; uri?: string }): void => {
  const url = isHostPageUri(uri)
    ? uri
    : `/${uri}${fragment ? `#${fragment}` : ""}`;
  window.history.pushState({}, "", url);
};

export const newUriWithFragment = (url: string): UriWithFragment => {
  const fragmentPos = url.lastIndexOf("#");
  return {
    uri: fragmentPos < 0 ? url : url.substring(0, fragmentPos),
    fragment: fragmentPos < 0 ? undefined : url.substring(fragmentPos + 1),
  };
};

export const browserPathProvider: ClosableProvider<UriWithFragment> = (
  push
) => {
  const update = link(map(currentUriWithFragment), push);

  window.addEventListener("popstate", update);
  return () => document.removeEventListener("popstate", update);
};
