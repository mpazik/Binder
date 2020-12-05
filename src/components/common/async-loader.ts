import {
  Component,
  ComponentRuntime,
  div,
  h1,
  p,
  span,
  View,
} from "../../libs/simple-ui/render";

export const loading: View = () => span("Loading...");

const errorMessage: View<{ error: string }> = ({ error }) =>
  div(h1(error), p(JSON.stringify(error)));

export const asyncLoader = <T extends unknown>(
  promise: Promise<T>,
  component: Component<T>
): ComponentRuntime => (render, onClose) => {
  render(loading());
  promise
    .then((value) => component(value)(render, onClose))
    .catch((error) => errorMessage(error));
};
