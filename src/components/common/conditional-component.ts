import type { Component, Slot } from "../../libs/simple-ui/render";
import { div } from "../../libs/simple-ui/render";

export const eitherComponent: Component<
  { slotA: Slot; slotB: Slot },
  { renderA: void; renderB: void }
> = ({ slotA, slotB }) => (render) => {
  return {
    renderA: () => {
      render(); // clean previous dom, to force rerender
      render(div(slotA));
    },
    renderB: () => {
      render(); // clean previous dom, to force rerender
      render(div(slotB));
    },
  };
};
