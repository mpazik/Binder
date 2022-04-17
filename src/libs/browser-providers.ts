import type { ClosableProvider } from "linki";
import { link, map, passOnlyChanged, to } from "linki";

import { hostPageUri, isHostPageUri } from "../components/app/special-uris";
import { isAbsoluteUri } from "../components/common/uri";

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

export type Uri = string;
export type UriWithFragment = {
  uri: Uri;
  fragment?: string;
};

export const currentUri = (): Uri => {
  const path = currentPath();
  return isAbsoluteUri(path) ? path : hostPageUri(path);
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

export const updateBrowserUri = (link: string): void => {
  const uri = (() => {
    if (link.startsWith("#")) {
      return `/${currentPath()}${link}`;
    } else {
      return isHostPageUri(link) ? link : `/${link}`;
    }
  })();

  window.history.pushState({}, "", uri);
  window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
};

export const newUriWithFragment = (url: string): UriWithFragment => {
  const fragmentPos = url.lastIndexOf("#");
  return {
    uri: fragmentPos < 0 ? url : url.substring(0, fragmentPos),
    fragment: fragmentPos < 0 ? undefined : url.substring(fragmentPos + 1),
  };
};

export const browserUriProvider: ClosableProvider<Uri> = (push) => {
  const update = link(map(currentUri), passOnlyChanged(currentUri()), push);

  window.addEventListener("popstate", update);
  return () => document.removeEventListener("popstate", update);
};

export const browserUriFragmentProvider: ClosableProvider<string> = (push) => {
  const update = link(map(to(currentFragment)), push);

  window.addEventListener("popstate", update);
  return () => document.removeEventListener("popstate", update);
};
