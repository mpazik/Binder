import { button, div, JsonHtml, jsonHtmlToDom } from "../libs/simple-ui/render";

const examples: JsonHtml[] = [button("test")];

const wrapper = (example: JsonHtml) => div(example);

{
  (async () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    examples.forEach((example) => {
      root.appendChild(jsonHtmlToDom(wrapper(example)));
    });
  })();
}
