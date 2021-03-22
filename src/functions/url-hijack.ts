import { queryParamProvider } from "../libs/browser-providers";
import { fork, Provider, ProviderSetup } from "../libs/connections";
import { map } from "../libs/connections/mappers";

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
    if (!uri || (uri && uri.startsWith("#"))) {
      return;
    }
    push(uri);
    event.preventDefault();
  };

  element.addEventListener("click", hijackLink);

  onClose(() => element.removeEventListener("click", hijackLink));
};

export const updateBrowserHistory = (uri: string): void => {
  const queryParams = new URLSearchParams(window.location.search);
  queryParams.set("uri", uri);
  window.history.pushState({}, "", "?" + queryParams.toString());
};

export const currentDocumentUriProvider = ({
  defaultUri,
}: {
  defaultUri: string;
}): Provider<string> => (onClose, push) => {
  const pushUrl = fork(updateBrowserHistory, push);
  linkHijack({})(onClose, pushUrl);
  queryParamProvider(
    onClose,
    map((it) => it.get("uri") || defaultUri, push)
  );
};
