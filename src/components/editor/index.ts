import type { View } from "linki-ui";
import { div, dom, h2 } from "linki-ui";
import { schema } from "prosemirror-schema-basic";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

export const editorPage: View = () => {
  const state = EditorState.create({ schema });
  const editorRoot = document.createElement("div");
  new EditorView(editorRoot, { state });
  return div(
    { class: "with-line-length-settings my-10" },
    h2("Editor"),
    dom(editorRoot)
  );
};
