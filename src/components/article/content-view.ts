import { URL } from "schema-dts";

import {
  documentContentRoodId,
  getDocumentContentRoot,
  LinkedDataWithDocument,
} from "../../functions/article-processor";
import { ArticleSaver } from "../../functions/article-saver";
import {
  combineLatest,
  Consumer,
  dataPortal,
  fork,
  Provider,
} from "../../libs/connections";
import { map } from "../../libs/connections/processors2";
import { findHashUri, findUrl, LinkedData } from "../../libs/linked-data";
import {
  a,
  article,
  Component,
  div,
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

export const contentDisplayComponent: Component<{
  provider: Provider<{ content: Document; editable: boolean }>;
  onDisplay: Consumer<HTMLElement>;
  onChange: Consumer<DocumentChange[]>;
}> = ({ provider, onDisplay, onChange }) => (render) => {
  provider(({ content, editable }) => {
    const contentRoot = getDocumentContentRoot(content);
    render(
      article({
        id: "editor-body",
        contenteditable: editable,
        class: "editable markdown-body flex-1",
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
      })
    );
  });
};

const isNew = (linkedData: LinkedData) => !findHashUri(linkedData);
const isEditable = (linkedData: LinkedData) => false;

export const editableContentComponent: Component<{
  provider: Provider<LinkedDataWithDocument>;
  articleSaver: ArticleSaver;
}> = ({ provider, articleSaver }) => (render) => {
  const [modalStateProvider, modalStateConsumer] = dataPortal<ModalState>();

  const [editBarStateOut, editBarStateIn] = dataPortal<EditBarState>();

  const setEditState = combineLatest<
    { element: HTMLElement | undefined },
    { content: LinkedDataWithDocument | undefined },
    { visible: boolean }
  >(
    { element: undefined },
    { content: undefined },
    { visible: false }
  )(({ element, content, visible }) => {
    if (!visible) {
      editBarStateIn(["hidden"]);
    } else if (element && content) {
      const { contentDocument, linkedData } = content;
      const saveDocument = () => {
        articleSaver({
          contentDocument: createNewDocument(contentDocument, element),
          linkedData,
        })
          .then(() => {
            editBarStateIn(["hidden"]);
          })
          .catch((reason) => {
            editBarStateIn([
              "error",
              {
                reason,
                onTryAgain: saveDocument,
              },
            ]);
          });
        editBarStateIn(["saving"]);
      };
      const discard = () =>
        revertDocument(getDocumentContentRoot(contentDocument), element);

      editBarStateIn([
        "visible",
        {
          onSave: saveDocument,
          onDiscard: isNew(linkedData) ? undefined : discard,
        },
      ]);
    }
  });

  const [changesProvider, onChange] = dataPortal<
    DocumentChange[] | undefined
  >();

  const [fieldsProvider, linkedDataForFields] = dataPortal<LinkedData>();
  const [contentProvider, documentToDisplay] = dataPortal<{
    content: Document;
    editable: boolean;
  }>();

  provider(
    fork(
      map(({ linkedData }) => linkedData, linkedDataForFields),
      map(
        ({ contentDocument, linkedData }) => ({
          content: contentDocument,
          editable: isEditable(linkedData),
        }),
        documentToDisplay
      ),
      () => modalStateConsumer(undefined), // reset modal
      (content) =>
        setEditState({
          visible: isNew(content.linkedData),
          content,
          element: undefined,
        }), // reset edit bar
      ({ linkedData }) => onChange(isEditable(linkedData) ? [] : undefined) // reset change bar
    )
  );

  render(
    div(
      { id: "content", class: "ml-4" },
      slot("content-fields", (render) => {
        fieldsProvider((linkedData) => render(contentHeaderView(linkedData)));
      }),
      div(
        { id: "editor", class: "mb-3 position-relative" },
        slot(
          "gutter",
          changesIndicatorBar({
            changesProvider,
            onDiffBarClick: (change) => {
              modalStateConsumer({
                top: documentChangeTopRelativePosition(change),
                left: 20,
                content: renderDocumentChangeModal({
                  oldLines: change.oldLines,
                  onRevert: () => {
                    revertDocumentChange(change);
                    modalStateConsumer(undefined);
                  },
                }),
              });
            },
          })
        ),
        slot("modal-diff", modal({ provider: modalStateProvider })),
        slot(
          "content",
          contentDisplayComponent({
            provider: contentProvider,
            onChange: fork(onChange, (changes) =>
              setEditState({
                visible: (changes && changes.length > 0) ?? false,
              })
            ),
            onDisplay: (element) => setEditState({ element }),
          })
        ),
        slot(
          "edit-bar",
          editBar({
            provider: editBarStateOut,
          })
        )
      )
    )
  );
};
