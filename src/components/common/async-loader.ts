import type {
  Component,
  ComponentBody,
  View,
} from "../../libs/simple-ui/render";
import { div, h1, pre, span } from "../../libs/simple-ui/render";

export const loading: View = () => span("Loading...");

const errorMessage: View<{ error: unknown }> = ({ error }) =>
  div(
    h1("Critical error"),
    pre(error instanceof Error ? error.message : JSON.stringify(error))
  );

export const asyncLoader = <T extends unknown>(
  promise: Promise<T>,
  component: Component<T>
): ComponentBody<void> => (render, onClose) => {
  render(loading());
  promise
    .then((value) => component(value)(render, onClose))
    .catch((error) => {
      console.error(error);
      render(errorMessage({ error }));
    });
};
