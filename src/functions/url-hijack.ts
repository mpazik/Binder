import type { ClosableProvider } from "linki";

const findLink = (element: HTMLElement | null): HTMLElement | undefined => {
  if (!element) return;
  if (element.nodeName === "A") return element;
  if (element.nodeName === "SPAN") return findLink(element.parentElement);
};
export const linkHijack = ({
  element = document,
}: {
  element?: Node;
} = {}): ClosableProvider<string> => (push) => {
  const hijackLink = (event: Event) => {
    const element = findLink(event.target as HTMLElement);
    if (!element) return;
    if (element.getAttribute("target")) {
      return; // ignore anchor with explicitly set target attribute
    }
    const uri = element.getAttribute("href");
    if (!uri || uri === "#") return;

    push(uri);
    event.preventDefault();
  };

  element.addEventListener("click", hijackLink);

  return () => {
    element.removeEventListener("click", hijackLink);
  };
};
