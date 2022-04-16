import type { View } from "linki-ui";
import { div } from "linki-ui";

export const centerLoading: View = () =>
  div({
    class: "loading black",
    style: {
      position: "fixed",
      left: "50%",
      top: "30%",
      transform: "translateX(-50%)",
    },
  });
