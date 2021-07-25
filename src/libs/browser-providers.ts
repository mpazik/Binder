import { ClosableProvider } from "../../../linki";

import { Provider } from "./connections";

export const urlHashProvider: Provider<string> = (onClose, push) => {
  const update = () => {
    const hash = location.hash;
    push(hash);
  };
  update();
  window.addEventListener("hashchange", update);
  onClose(() => {
    window.removeEventListener("hashchange", update);
  });
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
