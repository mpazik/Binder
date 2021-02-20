import { div, input, JsonHtml } from "../../libs/simple-ui/render";

export const searchBox = (onNewUrl: (url: URL) => void): JsonHtml =>
  div(
    { class: "my-3 mx-2" },
    input({
      class: "form-control width-full",
      type: "text",
      placeholder: "New page url",
      onFocus: (event) => {
        const input = event.target as HTMLInputElement;
        input.setSelectionRange(0, input.value.length);
      },
      onKeydown: (event) => {
        if (event.code === "Enter") {
          const potentialUrl = (event.target as HTMLInputElement).value;
          try {
            onNewUrl(new URL(potentialUrl));
          } catch (error) {
            alert(`"${potentialUrl}" is not a valid URL`);
          }
        }
      },
    })
  );
