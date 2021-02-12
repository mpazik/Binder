import { URL } from "schema-dts";

import {
  LinkedDataWithDocument,
  documentContentRoodId,
  getDocumentContentRoot,
} from "../../functions/article-processor";
import { Consumer, dataPortal, fork, wrapMerge } from "../../libs/connections";
import { map } from "../../libs/connections/processors2";
import { findHashUri, findUrl, LinkedData } from "../../libs/linked-data";
import { mapState } from "../../libs/named-state";
import {
  a,
  article,
  div,
  JsonHtml,
  slot,
  span,
  View,
} from "../../libs/simple-ui/render";
import { throttleArg } from "../../libs/throttle";
import { modal, ModalState } from "../common/modal";

import {
  changesIndicatorBar,
  documentChangeTopRelativePosition,
} from "./change-indicator-bar";
import {
  DocumentChange,
  newDocumentComparator,
  revertDocument,
  revertDocumentChange,
} from "./document-change";
import { renderDocumentChangeModal } from "./document-change-modal";
import { editBar, EditBarState } from "./edit-bar";

const createNewDocument = (
  initialContent: Document,
  editor: Element
): Document => {
  const newDocument = document.implementation.createHTMLDocument(
    initialContent.title
  );
  newDocument.head.innerHTML = initialContent.head.innerHTML;
  const newContentRoot = newDocument.createElement("div");
  newContentRoot.id = documentContentRoodId;
  newContentRoot.innerHTML = editor.innerHTML;
  newDocument.body.appendChild(newContentRoot);
  return newDocument;
};

const detectDocumentChange = (
  contentRoot: HTMLElement,
  onChange: (c: DocumentChange[]) => void
) => (e: InputEvent) =>
  throttleArg<Element>(
    map(newDocumentComparator(contentRoot), onChange),
    300
  )(e.target as HTMLElement);

const contentHeaderView: View<LinkedData> = (linkedData: LinkedData) => {
  const uri = findUrl(linkedData);
  return div(
    { class: "Subhead" },
    div({ class: "Subhead-heading" }, String(linkedData.name)),
    div(
      { class: "Subhead-description" },
      ...(uri ? [span("From: ", a({ href: uri }, new URL(uri).hostname))] : [])
    )
  );
};

const contentDisplay: View<{
  content: Document;
  onDisplay?: (element: HTMLElement) => void;
  onChange?: (c: DocumentChange[]) => void;
}> = ({ content, onDisplay, onChange }) => {
  const contentRoot = getDocumentContentRoot(content);
  const isEditable = Boolean(onChange);

  return article({
    id: "editor-body",
    contenteditable: isEditable,
    class: "editable markdown-body ml-4 flex-1",
    style: { outline: "none" },
    onInput: onChange
      ? detectDocumentChange(contentRoot, onChange) // ideally should be triggered on resize too
      : undefined,
    dangerouslySetInnerHTML: contentRoot?.innerHTML,
    onDisplay: onDisplay
      ? (e) => {
          const editorElement = e.target as HTMLElement;
          onDisplay(editorElement);
        }
      : undefined,
  });
};

const contentViewStructure = (
  linkedData: LinkedData,
  ...children: JsonHtml[]
) =>
  div(
    { id: "content" },
    contentHeaderView(linkedData),
    div({ id: "editor", class: "mb-3 position-relative" }, ...children)
  );

export type EditState = ["saving"] | ["error", string] | ["hidden"];
type EditStateInternal = EditState | ["visible"];

export const contentView: View<{
  data: LinkedDataWithDocument;
  editState?: EditState;
  onSave?: Consumer<LinkedDataWithDocument>;
}> = ({ data: { contentDocument, linkedData }, editState, onSave }) => {
  const isEditable = false;
  const isNew = !findHashUri(linkedData);

  if (!onSave || (!isNew && !isEditable)) {
    return contentViewStructure(
      linkedData,
      contentDisplay({ content: contentDocument })
    );
  }

  const [editBarStateOut, editBarStateIn] = dataPortal<EditBarState>();
  const [setEditorElement, setEditorBarState] = wrapMerge(
    "editorElement",
    "state"
  )<HTMLElement, EditStateInternal>()(
    map(({ editorElement, state }) => {
      const saveDocument = () =>
        onSave({
          contentDocument: createNewDocument(contentDocument, editorElement),
          linkedData,
        });
      return mapState<EditStateInternal, EditBarState>(state, {
        visible: () => [
          "visible",
          {
            onSave: saveDocument,
            onDiscard: isNew
              ? undefined
              : () =>
                  revertDocument(
                    getDocumentContentRoot(contentDocument),
                    editorElement
                  ),
          },
        ],
        hidden: () => ["hidden"],
        saving: () => ["saving"],
        error: (reason) => ["error", { reason, onTryAgain: saveDocument }],
      });
    }, editBarStateIn)
  );

  const editorSlot = slot(
    "edit-bar",
    editBar({
      provider: editBarStateOut,
    })
  );

  if (isNew) {
    return contentViewStructure(
      linkedData,
      contentDisplay({
        content: contentDocument,
        onDisplay: (element) => {
          setEditorElement(element);
          setEditorBarState(editState || ["visible"]);
        },
      }),
      editorSlot
    );
  }

  const [stateProvider, stateConsumer] = dataPortal<ModalState>();
  const onDiffBarClick: Consumer<DocumentChange> = (change) => {
    const { oldLines } = change;
    stateConsumer({
      top: documentChangeTopRelativePosition(change),
      left: 20,
      content: renderDocumentChangeModal({
        oldLines,
        onRevert: () => {
          revertDocumentChange(change);
          stateConsumer(undefined);
        },
      }),
    });
  };

  const [changesProvider, onChange] = dataPortal<DocumentChange[]>();

  return contentViewStructure(
    linkedData,
    slot(
      "gutter",
      changesIndicatorBar({
        changesProvider,
        onDiffBarClick,
      })
    ),
    slot("modal-diff", modal({ stateProvider })),
    contentDisplay({
      content: contentDocument,
      onDisplay: (element) => {
        setEditorElement(element);
        setEditorBarState(editState || ["hidden"]);
      },
      onChange: fork(
        onChange,
        map(
          (changes): EditStateInternal =>
            changes.length === 0 ? ["hidden"] : ["visible"],
          setEditorBarState
        )
      ),
    }),
    editorSlot
  );
};
