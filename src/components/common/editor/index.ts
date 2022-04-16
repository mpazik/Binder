import type { Callback } from "linki";
import type { UiComponent } from "linki-ui";
import { div, dom, renderJsonHtmlToDom } from "linki-ui";
import type { Command } from "prosemirror-commands";
import {
  chainCommands,
  createParagraphNear,
  deleteSelection,
  exitCode,
  joinBackward,
  joinForward,
  liftEmptyBlock,
  newlineInCode,
  selectAll,
  selectNodeBackward,
  selectNodeForward,
  splitBlock,
  toggleMark,
} from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { Node } from "prosemirror-model";
import {
  DOMParser as PMParser,
  DOMSerializer as PMSerializer,
  Schema,
} from "prosemirror-model";
import { marks, nodes } from "prosemirror-schema-basic";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import "./style.css";

type HtmlString = string;

const schema = new Schema({
  marks,
  nodes,
});

const backspace = chainCommands(
  deleteSelection,
  joinBackward,
  selectNodeBackward
);

const del = chainCommands(deleteSelection, joinForward, selectNodeForward);
const addBreak = chainCommands(exitCode, (state, dispatch) => {
  if (dispatch)
    dispatch(
      state.tr
        .replaceSelectionWith(schema.nodes.hard_break.create())
        .scrollIntoView()
    );
  return true;
});

const documentFragmentToHtml = (fragment: DocumentFragment) =>
  Array.from(fragment.children)
    .map((child) => child.outerHTML)
    .join("");

const serialiseToHtml = <T extends Schema>(state: EditorState<T>): HtmlString =>
  documentFragmentToHtml(
    PMSerializer.fromSchema(schema).serializeFragment(state.doc.content)
  );

const parseFromHtml = <T extends Schema>(
  schema: T,
  html: HtmlString
): Node<T> =>
  PMParser.fromSchema(schema).parse(
    new DOMParser().parseFromString(html, "text/html")
  );

const save = (onSave: Callback): Command<typeof schema> => (
  state,
  dispatch
) => {
  if (dispatch) {
    onSave();
  }
  return true;
};

const keyBindings = {
  Enter: chainCommands(
    newlineInCode,
    createParagraphNear,
    liftEmptyBlock,
    splitBlock
  ),
  Backspace: backspace,
  "Mod-Backspace": backspace,
  "Shift-Backspace": backspace,
  Delete: del,
  "Mod-Delete": del,
  "Mod-a": selectAll,
  "Mod-z": undo,
  "Mod-y": redo,
  "Shift-Enter": addBreak,
  "Mod-b": toggleMark(schema.marks.strong),
  "Mod-i": toggleMark(schema.marks.em),
};

export const editor = ({
  initialContent,
  class: className = "",
  style = {},
}: {
  initialContent?: HtmlString;
  class?: string;
  style?: Partial<CSSStyleDeclaration>;
} = {}): UiComponent<
  { save: void; reset: void },
  { onSave: HtmlString; onEscape?: void }
> => ({ render, onSave, onEscape }) => {
  const editorContainer = document.createElement("div");
  editorContainer.style.position = "relative";
  const editorRoot = renderJsonHtmlToDom(
    div({ class: ["p-2 pt-3 pl-4 form-control", className].join(" "), style })
  ) as HTMLElement;
  editorContainer.appendChild(editorRoot);
  const doc = initialContent
    ? parseFromHtml(schema, initialContent)
    : undefined;

  const handleSave = () => {
    onSave(serialiseToHtml(view.state));
  };

  const resetViewState = (view: EditorView) => {
    view.updateState(
      EditorState.create({
        schema: view.state.schema,
        doc: undefined,
        plugins: view.state.plugins,
      })
    );
  };

  // Drag-drop block extension
  // https://codesandbox.io/s/remirror-dragndrop-extension-hou3j?file=/src/dragndrop-extension/index.js
  const view = new EditorView(
    { mount: editorRoot },
    {
      state: EditorState.create({
        doc,
        schema,
        plugins: [
          history(),
          keymap(keyBindings),
          keymap({
            ...(onEscape
              ? {
                  Escape: () => {
                    onEscape();
                    return true;
                  },
                }
              : {}),
            "Mod-Enter": save(handleSave),
          }),
        ],
      }),
    }
  );

  render(dom(editorContainer));

  return {
    save: handleSave,
    reset: () => {
      resetViewState(view);
    },
  };
};
