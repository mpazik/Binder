import { Provider } from "../libs/connections";

export const urlHashProvider: Provider<string> = (signal, push) => {
  const update = () => {
    const hash = location.hash;
    push(hash);
  };
  update();
  window.addEventListener("hashchange", update);
  signal.addEventListener("aborted", () =>
    window.removeEventListener("hashchange", update)
  );
};

export const queryParamProvider: Provider<URLSearchParams> = (signal, push) => {
  const update = () => push(new URLSearchParams(window.location.search));

  update();
  window.addEventListener("popstate", update);

  signal.addEventListener("aborted", () =>
    document.removeEventListener("popstate", update)
  );
};
