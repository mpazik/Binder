import { button, div, h2, mountComponent } from "linki-ui";

import { editor } from "../common/editor";
import type { PageView } from "../pages/utils";

const xmlString = '<p><a href="#">Link</a>Blet</p><p>haha</p>';

export const editorPage: PageView = () => {
  const [editorRoot, { save, reset }] = mountComponent(
    editor({ initialContent: xmlString }),
    {
      onSave: (data) => {
        console.log(data);
      },
    }
  );
  return div(
    { class: "with-line-length-settings my-10" },
    h2("Editor"),
    editorRoot,
    button(
      {
        onClick: () => save(),
      },
      "Save"
    ),
    button(
      {
        onClick: () => reset(),
      },
      "Reset"
    )
  );
};
