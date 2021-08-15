import { fork } from "linki";

import { linkHijack } from "../../functions/url-hijack";
import { browserPathProvider } from "../../libs/browser-providers";
import { Component, div, slot, Slot } from "../../libs/simple-ui/render";
import { AboutPage } from "../../pages/about";
import { App } from "../app";

export const Router: Component<{
  mapping: Map<string, Slot>;
  default: Slot;
}> = (props) => (render, onClose) => {
  const handleUri = (uri: string) => {
    const slot = props.mapping.get(uri) ?? props.default;
    render(div(slot));
  };
  onClose(browserPathProvider(handleUri));
  onClose(
    linkHijack({ predicate: (uri) => uri.startsWith("/") })(
      fork(handleUri, (path) => history.pushState(null, "", path))
    )
  );
};

export const AppRouter: Component = () =>
  Router({
    mapping: new Map([["/about", slot("about", AboutPage)]]),
    default: slot("app", App),
  });
