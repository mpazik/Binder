import { div, View } from "../../libs/simple-ui/render";

export const centerLoading: View = () =>
  div(
    {
      style: {
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        "z-index": "1",
      },
    },
    div({ class: "loading black", style: { position: "fixed", top: "200px" } })
  );
