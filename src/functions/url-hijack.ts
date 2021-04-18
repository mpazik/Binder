import { getQueryParams, queryParamProvider } from "../libs/browser-providers";
import { fork, Provider, ProviderSetup } from "../libs/connections";
import { map, pipe } from "../libs/connections/mappers";
import { throwIfNull } from "../libs/errors";

const linkHijack: ProviderSetup<{ element?: Node }, string> = ({
  element = document,
}) => (onClose, push) => {
  const hijackLink = (event: Event) => {
    const element = event.target as HTMLElement;
    if (!element || element.nodeName !== "A") return;
    if (element.getAttribute("target")) {
      return; // ignore anchor with explicitly set target attribute
    }
    const uri = element.getAttribute("href");
    if (!uri) {
      return;
    }
    push(uri);
    event.preventDefault();
  };

  element.addEventListener("click", hijackLink);

  onClose(() => element.removeEventListener("click", hijackLink));
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

const getCurrentUri = () => throwIfNull(getQueryParams().get("uri"));

export const currentDocumentUriProvider = ({
  defaultUri,
}: {
  defaultUri: string;
}): Provider<UriWithFragment> => (onClose, push) => {
  linkHijack({})(
    onClose,
    map(
      pipe(newUriWithFragment, (it) =>
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
  queryParamProvider(
    onClose,
    map(({ queryParams, fragment }) => {
      const uri = queryParams.get("uri");
      return {
        uri: uri ?? defaultUri,
        fragment: uri ? fragment : undefined, // don't return fragment for default url
      };
    }, push)
  );
};
