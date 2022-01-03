import type { NamedCallbacks } from "linki";
import type { JsonHtml, View } from "linki-ui";
import { renderJsonHtmlToDom } from "linki-ui";

const componentClass = "component";

export type ViewSetup<C, T> = (c: C) => View<T>;

export const makeComponent = (
  element: HTMLElement,
  onConnected: () => void,
  onDisconnected: () => void
): HTMLElement => {
  element.classList.add(componentClass);
  element.addEventListener("connected", onConnected);
  element.addEventListener("disconnected", onDisconnected);
  return element;
};

export const createChildComponentsHandler = (): ((dom: Node) => void) => {
  let existingComponents: Element[] = [];

  return (dom) => {
    const renderedComponents: Element[] = (() => {
      if (dom.nodeType === Node.ELEMENT_NODE) {
        return Array.from(
          (dom as Element).getElementsByClassName(componentClass)
        );
      }
      if (dom.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        return Array.from(
          (dom as DocumentFragment).querySelectorAll("." + componentClass)
        );
      }
      return [];
    })();
    renderedComponents
      .filter((it) => existingComponents.indexOf(it) < 0)
      .forEach((newComponent) => {
        newComponent.dispatchEvent(new CustomEvent("connected"));
      });

    existingComponents
      .filter((it) => renderedComponents.indexOf(it) < 0)
      .forEach((oldComponent) => {
        oldComponent.dispatchEvent(new CustomEvent("disconnected"));
      });

    existingComponents = renderedComponents;
  };
};

export type ElementComponent<T = void, S extends object = {}> = (
  props: T
) => [HTMLElement, NamedCallbacks<S>];

export type Renderer = (jsonHtml: JsonHtml) => void;

export const createUiComponent = <T = void, S extends object = {}>(
  factory: (props: T, render: Renderer) => NamedCallbacks<S>
): ElementComponent<T, S> => {
  return (props) => {
    const parent: HTMLElement = document.createElement("div");
    const handlers = factory(props, (jsonHtml) => {
      parent.innerHTML = "";
      console.log("jsonHtml", jsonHtml);
      const newChild = renderJsonHtmlToDom(jsonHtml);
      console.log("newChild", newChild);
      parent.appendChild(newChild);
    });
    return [parent, handlers];
  };
};
