import { Provider } from "../utils/connections";

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

export const queryParamProvider: Provider<URLSearchParams> = (
  onClose,
  push
) => {
  const update = () => push(new URLSearchParams(window.location.search));

  update();
  window.addEventListener("popstate", update);

  onClose(() => document.removeEventListener("popstate", update));
};
