import { createComponentRenderer, mountComponent } from "linki-ui";

import { App, initialiseServices } from "./components/system";
import { processInternalDocument } from "./functions/content-processors/html-processor/internal-processor";
import type { LinkedData } from "./libs/jsonld-format";
import { measureAsyncTime } from "./libs/performance";

const rootElement = "root";
const contentRootElement = "content-root";

const getRoot = (): HTMLElement => {
  const existingRoot = document.getElementById(rootElement);
  if (existingRoot) {
    existingRoot.innerHTML = "";
    return existingRoot;
  }
  const newRoot = document.createElement("div");
  newRoot.id = rootElement;
  document.body.appendChild(newRoot);
  return newRoot;
};

const getDocumentContent = (): LinkedData | undefined => {
  const contentRoot = document.getElementById(contentRootElement);
  if (!contentRoot || contentRoot.children.length === 0) return;

  return processInternalDocument(document);
};

(async () => {
  const initialServices = await measureAsyncTime("init", initialiseServices);
  const root = getRoot();
  const initialContent = getDocumentContent();
  const render = createComponentRenderer(root);
  const [appNode] = mountComponent(App({ ...initialServices, initialContent }));
  render(appNode);
})();
