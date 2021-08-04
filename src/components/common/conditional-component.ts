import { Component, div, Slot } from "../../libs/simple-ui/render";

export const eitherComponent: Component<
  { slotA: Slot; slotB: Slot },
  { renderA: void; renderB: void }
> = ({ slotA, slotB }) => (render) => {
  return {
    renderA: () => {
      render(div(slotA));
    },
    renderB: () => {
      render(div(slotB));
    },
  };
};
