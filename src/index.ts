import "./styles/styles.css";
import "./styles/loading.css";

import { AppRouter } from "./components/router";
import { setupComponent } from "./libs/simple-ui/render";

(async () => {
  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);

  setupComponent(AppRouter(), root);
})();
