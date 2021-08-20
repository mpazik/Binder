import { pathProvider } from "../../libs/browser-providers";
import { listDbs } from "../../libs/indexeddb";
import { Component, div, slot, Slot } from "../../libs/simple-ui/render";
import { AboutPage } from "../../pages/about";
import { App } from "../app";

export const Router: Component<{
  mapping: Map<string, Slot>;
  default: Slot;
}> = (props) => (render, onClose) => {
  const handleUri = (uri: string) => {
    if (uri === "/") {
      listDbs().then((list) => {
        window.location.href = list.length ? "/directory" : "/about";
      });
    } else {
      const slot = props.mapping.get(uri) ?? props.default;
      render(div(slot));
    }
  };
  onClose(pathProvider(handleUri));
};

export const AppRouter: Component = () =>
  Router({
    mapping: new Map([
      ["/about", slot("about", AboutPage)],
      ["/directory", slot("directory", App)],
    ]),
    default: slot("app", App),
  });
