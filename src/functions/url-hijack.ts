import { Provider, ProviderFactory } from "../utils/connections";

import { queryParamProvider } from "./browser";

const linkHijack: ProviderFactory<{ element?: Node }, string> = ({
  element = document,
}) => (onClose, push) => {
  const hijackLink = (event: Event) => {
    const target = event.target as HTMLElement;
    if (!target || target.nodeName !== "A") return;
    const uri = target.getAttribute("href");
    if (!uri || (uri && uri.startsWith("#"))) {
      return;
    }
    push(uri);
    event.preventDefault();
  };

  element.addEventListener("click", hijackLink);

  onClose(() => element.removeEventListener("click", hijackLink));
};

export const linkHijackToQueryParams: Provider<URLSearchParams> = (
  onClose,
  push
) => {
  linkHijack({})(onClose, (uri) => {
    const queryParams = new URLSearchParams(window.location.search);
    queryParams.set("uri", uri);
    window.history.pushState({}, "", "?" + queryParams.toString());
    push(queryParams);
  });
  queryParamProvider(onClose, push);
};
