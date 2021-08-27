import {
  appNavigation,
  appNavigationWithConfig,
  emptyNavigation,
  emptyNavigationWithLargeLogo,
} from "../components/navigation/examples";
import { div, JsonHtml, jsonHtmlToDom } from "../libs/simple-ui/render";

const navigationExamples = [
  emptyNavigation,
  emptyNavigationWithLargeLogo,
  appNavigation,
  appNavigationWithConfig,
];

const examples: JsonHtml[] = navigationExamples;

const wrapper = (example: JsonHtml) => div(example);

{
  (async () => {
    document.body.appendChild(
      jsonHtmlToDom(
        div(
          {
            class: "d-flex flex-column",
            style: { gap: "32px", margin: "0 auto", maxWidth: "800px" },
          },
          ...examples.map((example) => wrapper(example))
        )
      )
    );
  })();
}
