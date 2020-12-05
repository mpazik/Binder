import { mapTo } from "../../libs/connections";
import { Component, View } from "../../libs/simple-ui/render";

const centerLoadingView: View = () => [
  "div",
  {
    class: "loading black",
    style: {
      position: "fixed",
      left: "50%",
      top: "30%",
      transform: "translateX(-50%)",
    },
  },
];

export const centerLoading: Component = () => (render, onClose) => {
  const timeout = setTimeout(mapTo(centerLoadingView())(render), 300);

  onClose(() => clearTimeout(timeout));
};
