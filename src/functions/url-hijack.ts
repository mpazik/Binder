import {
  mapInput,
  Provider,
  ProviderFactory,
  providerMerge,
} from "../libs/connections";

import { queryParamProvider } from "./browser";

const linkHijack: ProviderFactory<{ element?: Node }, string> = ({
  element = document,
}) => (signal, push) => {
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

  signal.addEventListener("aborted", () =>
    element.removeEventListener("click", hijackLink)
  );
};

export const linkHijackToQueryParams: Provider<URLSearchParams> = providerMerge(
  mapInput(linkHijack({}), (uri) => {
    const queryParams = new URLSearchParams(window.location.search);
    queryParams.set("uri", uri);
    window.history.pushState({}, "", "?" + queryParams.toString());
    return queryParams;
  }),
  queryParamProvider
);
