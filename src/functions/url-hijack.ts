import { queryParamProvider } from "../libs/browser-providers";
import { ClosableProvider, fork, ProviderSetup } from "../libs/connections";
import { map } from "../libs/connections/processors2";

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

function updateBrowserHistory(uri: string) {
  const queryParams = new URLSearchParams(window.location.search);
  queryParams.set("uri", uri);
  window.history.pushState({}, "", "?" + queryParams.toString());
}

export const currentDocumentUriProvider: ClosableProvider<
  string | undefined | null
> = (onClose, push) => {
  linkHijack({})(onClose, fork(updateBrowserHistory, push));
  queryParamProvider(
    onClose,
    map((it) => it.get("uri"), push)
  );
};
