import { ClosableProvider, fork, link, map, Predicate } from "linki";

import { getQueryParams, queryParamProvider } from "../libs/browser-providers";
import { throwIfNull } from "../libs/errors";

const findLink = (element: HTMLElement | null): HTMLElement | undefined => {
  if (!element) return;
  if (element.nodeName === "A") return element;
  if (element.nodeName === "SPAN") return findLink(element.parentElement);
};
export const linkHijack = ({
  predicate = () => true,
  element = document,
}: {
  element?: Node;
  predicate?: Predicate<string>;
}): ClosableProvider<string> => (push) => {
  const hijackLink = (event: Event) => {
    const element = findLink(event.target as HTMLElement);
    if (!element) return;
    if (element.getAttribute("target")) {
      return; // ignore anchor with explicitly set target attribute
    }
    const uri = element.getAttribute("href");
    if (!uri) return;
    if (!predicate(uri)) return;

    push(uri);
    event.preventDefault();
  };

  element.addEventListener("click", hijackLink);

  return () => element.removeEventListener("click", hijackLink);
};

export const updateBrowserHistory = ({
  uri = getCurrentUri(),
  fragment,
}: UriWithFragment | { fragment: string; uri?: string }): void => {
  const queryParams = new URLSearchParams(window.location.search);
  queryParams.set("uri", uri);
  window.history.pushState(
    {},
    "",
    `?${queryParams.toString()}${fragment ? `#${fragment}` : ""}`
  );
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

const getCurrentUri = () => throwIfNull(getQueryParams().get("uri"));

export const browserUriProvider = ({
  defaultUri,
}: {
  defaultUri: string;
}): ClosableProvider<UriWithFragment> => (push) =>
  queryParamProvider(
    link(
      map(({ queryParams, fragment }) => {
        const uri = queryParams.get("uri");
        return {
          uri: uri ?? defaultUri,
          fragment: uri ? fragment : undefined, // don't return fragment for default url
        };
      }),
      push
    )
  );

export const documentLinksUriProvider: ClosableProvider<UriWithFragment> = (
  push
) => {
  return linkHijack({
    predicate: (uri) =>
      uri.startsWith("http://") ||
      uri.startsWith("https://") ||
      uri.startsWith("nih:"),
  })(
    link(
      map(newUriWithFragment, (it) =>
        it.uri === ""
          ? {
              uri: getCurrentUri(),
              fragment: it.fragment,
            }
          : it
      ),
      fork(updateBrowserHistory, push)
    )
  );
};
