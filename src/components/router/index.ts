import { fork } from "linki";

import { linkHijack } from "../../functions/url-hijack";
import { browserPathProvider } from "../../libs/browser-providers";
import { a, Component, div, slot, Slot } from "../../libs/simple-ui/render";
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

export const AppRouter: Component<void, void> = () =>
  Router({
    mapping: new Map([
      [
        "/about",
        slot("about", (render) => {
          render(div(a({ href: "/" }, "start")));
        }),
      ],
    ]),
    default: slot("app", App),
  });
