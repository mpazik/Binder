import { App, initialiseServices } from "./components/app";
import { measureAsyncTime } from "./libs/performance";
import { setupComponent } from "./libs/simple-ui/render";

(async () => {
  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);

  const initialServices = await measureAsyncTime("init", initialiseServices);

  setupComponent(App(initialServices), root);
})();
