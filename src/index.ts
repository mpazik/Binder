import { App } from "./components/app";
import { setupComponent } from "./libs/simple-ui/render";

(async () => {
  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);

  setupComponent(App, root);
})();
