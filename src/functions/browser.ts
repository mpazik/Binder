import type { Provider } from "linki";

export const urlHashProvider: Provider<string> = (push) => {
  const update = () => {
    const hash = location.hash;
    push(hash);
  };
  update();
  window.addEventListener("hashchange", update);
  return () => {
    window.removeEventListener("hashchange", update);
  };
};
