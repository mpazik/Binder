import {
  documentContentRoodId,
  getDocumentContentRoot,
  LinkedDataWithDocument,
} from "../../functions/article-processor";
import { createArticleSaver } from "../../functions/article-saver";
import {
  LinkedDataStoreWrite,
  ResourceStoreWrite,
} from "../../functions/store";
import {
  Consumer,
  dataPortal,
  fork,
  passOnlyChanged,
  Provider,
} from "../../libs/connections";
import { withState } from "../../libs/connections";
import { map } from "../../libs/connections/mappers";
import { throwIfNull } from "../../libs/errors";
import {
  findHashUri,
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/linked-data";
import { Component, fragment, slot } from "../../libs/simple-ui/render";
import { modal, ModalState } from "../common/modal";

import {
  changesIndicatorBar,
  documentChangeTopRelativePosition,
} from "./change-indicator-bar";
import {
  DocumentChange,
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

const isNew = (linkedData: LinkedData) => !findHashUri(linkedData);
export const isEditable: (linkedData: LinkedData) => boolean = () => false;

export type EditorContext = LinkedDataWithDocument & {
  container: HTMLElement;
};
export type EditorContextWithHash = EditorContext & {
  linkedData: LinkedDataWithHashId;
};

export const articleEditSupport: Component<{
  changesProvider: Provider<DocumentChange[] | undefined>;
  editorContextProvider: Provider<EditorContext>;
  storeWrite: ResourceStoreWrite;
  ldStoreWrite: LinkedDataStoreWrite;
  onSave: Consumer<EditorContextWithHash>;
  saveRequestProvider: Provider<void>;
}> = ({
  changesProvider,
  editorContextProvider,
  storeWrite,
  ldStoreWrite,
  onSave,
  saveRequestProvider,
}) => (render, onClose) => {
  const [editBarStateOut, editBarStateIn] = dataPortal<EditBarState>();
  const [modalStateProvider, modalStateConsumer] = dataPortal<ModalState>();
  const [changesProvider2, onChange] = dataPortal<
    DocumentChange[] | undefined
  >();
  changesProvider(
    onClose,
    fork(
      onChange,
      map(
        (changes) => Boolean(changes && changes.length > 0),
        passOnlyChanged((modified) => editBarStateUpdater(modified, modified))
      )
    )
  );

  const articleSaver = createArticleSaver(storeWrite, ldStoreWrite);

  const [discard, setContextForDiscard] = withState<EditorContext>(
    (editorContext) => {
      const { container, contentDocument } = throwIfNull(editorContext);
      revertDocument(getDocumentContentRoot(contentDocument), container);
    }
  );

  const [saveArticle, setContextForSave] = withState<EditorContext>(
    (editorContext) => {
      const { linkedData, container, contentDocument } = editorContext;
      try {
        const newContentDocument = isNew(linkedData)
          ? contentDocument
          : createNewDocument(contentDocument, container);
        articleSaver({
          contentDocument: newContentDocument,
          linkedData,
        }).then((newLinkedData) => {
          editBarStateIn(["hidden"]);
          onSave({
            linkedData: newLinkedData,
            contentDocument: newContentDocument,
            container,
          });
        });
      } catch (error) {
        editBarStateIn([
          "error",
          {
            reason: error,
            onTryAgain: () => saveArticle(),
          },
        ]);
      }
    }
  );

  editorContextProvider(
    onClose,
    fork(
      () => modalStateConsumer(undefined), // reset modal
      ({ linkedData }) => onChange(isEditable(linkedData) ? [] : undefined), // reset change bar
      setContextForSave,
      setContextForDiscard,
      map(
        ({ linkedData }) => isNew(linkedData),
        (newDocument) => {
          editBarStateUpdater(newDocument, newDocument);
        }
      )
    )
  );

  saveRequestProvider(onClose, saveArticle);

  const editBarStateUpdater = (visible: boolean, modified = false) =>
    editBarStateIn(
      visible
        ? [
            "visible",
            {
              showDiscard: modified,
            },
          ]
        : ["hidden"]
    );

  render(
    fragment(
      slot(
        "gutter",
        changesIndicatorBar({
          changesProvider: changesProvider2,
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
        "edit-bar",
        editBar({
          onSave: saveArticle,
          onDiscard: discard,
          provider: editBarStateOut,
        })
      )
    )
  );
};
