import { Provider } from "../libs/connections";

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
