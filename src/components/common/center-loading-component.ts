import type { View } from "../../libs/simple-ui/render";
import { div } from "../../libs/simple-ui/render";

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
