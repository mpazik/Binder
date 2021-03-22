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
import { Consumer, fork, passOnlyChanged } from "../../libs/connections";
import { withState } from "../../libs/connections";
import { map, pick, pipe } from "../../libs/connections/mappers";
import { throwIfNull } from "../../libs/errors";
import {
  findHashUri,
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/linked-data";
import { Component, fragment, newSlot } from "../../libs/simple-ui/render";
import { modal } from "../common/modal";

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
import { editBar } from "./edit-bar";

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

export const articleEditSupport: Component<
  {
    storeWrite: ResourceStoreWrite;
    ldStoreWrite: LinkedDataStoreWrite;
    onSave: Consumer<EditorContextWithHash>;
  },
  {
    saveArticle: void;
    displayChanges: DocumentChange[] | undefined;
    setEditorContext: EditorContext;
  }
> = ({ storeWrite, ldStoreWrite, onSave }) => (render) => {
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
          updateEditBar(["hidden"]);
          onSave({
            linkedData: newLinkedData,
            contentDocument: newContentDocument,
            container,
          });
        });
      } catch (error) {
        updateEditBar([
          "error",
          {
            reason: error,
            onTryAgain: () => saveArticle(),
          },
        ]);
      }
    }
  );

  const editBarStateUpdater = (visible: boolean, modified = false) =>
    updateEditBar(
      visible
        ? [
            "visible",
            {
              showDiscard: modified,
            },
          ]
        : ["hidden"]
    );

  const [gutterSlot, { displayChangesOnBar }] = newSlot(
    "gutter",
    changesIndicatorBar({
      onDiffBarClick: (change) => {
        displayModal({
          top: documentChangeTopRelativePosition(change),
          left: 20,
          content: renderDocumentChangeModal({
            oldLines: change.oldLines,
            onRevert: () => {
              revertDocumentChange(change);
              displayModal(undefined);
            },
          }),
        });
      },
    })
  );
  const [modalDiffSlot, { displayModal }] = newSlot("modal-diff", modal());
  const [editBarSlot, { updateEditBar }] = newSlot(
    "edit-bar",
    editBar({
      onSave: saveArticle,
      onDiscard: discard,
    })
  );
  render(fragment(gutterSlot, modalDiffSlot, editBarSlot));

  return {
    setEditorContext: fork(
      () => displayModal(undefined), // reset modal
      ({ linkedData }) =>
        displayChangesOnBar(isEditable(linkedData) ? [] : undefined), // reset change bar
      setContextForSave,
      setContextForDiscard,
      map(pipe(pick("linkedData"), isNew), (newDocument) => {
        editBarStateUpdater(newDocument, !newDocument);
      })
    ),
    saveArticle,
    displayChanges: fork(
      displayChangesOnBar,
      map(
        (changes) => Boolean(changes && changes.length > 0),
        passOnlyChanged((modified) => editBarStateUpdater(modified, modified))
      )
    ),
  };
};
