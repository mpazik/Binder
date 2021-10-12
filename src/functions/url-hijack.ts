import type { ClosableProvider } from "linki";
import { fork, link, map } from "linki";

import { hostPageUri, isHostPageUri } from "../components/app/special-uris";
import { isAbsoluteUrl } from "../components/common/link";
import { currentPath } from "../libs/browser-providers";

const findLink = (element: HTMLElement | null): HTMLElement | undefined => {
  if (!element) return;
  if (element.nodeName === "A") return element;
  if (element.nodeName === "SPAN") return findLink(element.parentElement);
};
export const linkHijack = ({
  element = document,
}: {
  element?: Node;
} = {}): ClosableProvider<string> => (push) => {
  const hijackLink = (event: Event) => {
    const element = findLink(event.target as HTMLElement);
    if (!element) return;
    if (element.getAttribute("target")) {
      return; // ignore anchor with explicitly set target attribute
    }
    const uri = element.getAttribute("href");
    if (!uri) return;

    push(uri);
    event.preventDefault();
  };

  element.addEventListener("click", hijackLink);

  return () => element.removeEventListener("click", hijackLink);
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

export type UriWithFragment = {
  uri: string;
  fragment?: string;
};

export const newUriWithFragment = (url: string): UriWithFragment => {
  const fragmentPos = url.lastIndexOf("#");
  return {
    uri: fragmentPos < 0 ? url : url.substring(0, fragmentPos),
    fragment: fragmentPos < 0 ? undefined : url.substring(fragmentPos + 1),
  };
};

export const combineToUri = ({ uri, fragment }: UriWithFragment): string =>
  fragment ? `${uri}#${fragment}` : uri;

export const pathToUri = (path: string): UriWithFragment => {
  return newUriWithFragment(isAbsoluteUrl(path) ? path : hostPageUri(path));
};

export const documentLinksUriProvider: ClosableProvider<UriWithFragment> = (
  push
) => {
  return linkHijack()(
    link(
      map(newUriWithFragment, (it) =>
        it.uri === ""
          ? {
              uri: currentPath(),
              fragment: it.fragment,
            }
          : it
      ),
      fork(updateBrowserHistory, push)
    )
  );
};
