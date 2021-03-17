import { URL } from "schema-dts";

import {
  documentContentRoodId,
  getDocumentContentRoot,
  LinkedDataWithDocument,
} from "../../functions/article-processor";
import { createArticleSaver } from "../../functions/article-saver";
import { DocumentAnnotationsIndex } from "../../functions/indexes/document-annotations-index";
import {
  LinkedDataStoreWrite,
  ResourceStoreWrite,
} from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { Consumer, dataPortal, fork, Provider } from "../../libs/connections";
import { Callback, map, statefulMap } from "../../libs/connections/processors2";
import { throwIfNull } from "../../libs/errors";
import { HashUri } from "../../libs/hash";
import {
  findHashUri,
  findUrl,
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/linked-data";
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
import { annotationsSupport } from "../annotations";
import { currentSelection, OptSelection } from "../annotations/selection";
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
      ...(uri
        ? [
            span(
              "From: ",
              a({ href: uri, target: "_blank" }, new URL(uri).hostname)
            ),
          ]
        : [])
    )
  );
};

export const contentDisplayComponent: Component<{
  provider: Provider<{ content: Document; editable: boolean }>;
  onDisplay: Consumer<HTMLElement>;
  onChange: Consumer<DocumentChange[]>;
  onSelect: Consumer<OptSelection>;
}> = ({ provider, onDisplay, onChange, onSelect }) => (render, onClose) => {
  provider(onClose, ({ content, editable }) => {
    const contentRoot = getDocumentContentRoot(content);
    let editorElement: HTMLElement | undefined;
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
        onMouseup: () => {
          if (editorElement) onSelect(currentSelection(editorElement));
        },
        onFocusout: () => {
          console.log("focus out");
          onSelect(undefined);
        },
        onDisplay: (e) => {
          editorElement = e.target as HTMLElement;
          if (onDisplay) {
            onDisplay(editorElement);
          }
        },
      })
    );
  });
};

const isNew = (linkedData: LinkedData) => !findHashUri(linkedData);
const isEditable: (linkedData: LinkedData) => boolean = () => false;

const createEditBarStateUpdater = (
  editBarStateIn: (value: EditBarState) => void,
  onSave: () => void,
  onDiscard: () => void
) => ({ visible, newDocument }: { visible: boolean; newDocument: boolean }) => {
  if (!visible) {
    editBarStateIn(["hidden"]);
  } else {
    editBarStateIn([
      "visible",
      {
        onSave: onSave,
        onDiscard: newDocument ? undefined : onDiscard,
      },
    ]);
  }
};

type EditorContext = LinkedDataWithDocument & {
  container: HTMLElement;
};

export const editableContentComponent: Component<{
  provider: Provider<LinkedDataWithDocument>;
  storeWrite: ResourceStoreWrite;
  ldStoreWrite: LinkedDataStoreWrite;
  ldStoreRead: LinkedDataStoreRead;
  onSave: Consumer<LinkedDataWithHashId>;
  documentAnnotationsIndex: DocumentAnnotationsIndex;
  creatorProvider: Provider<string>;
}> = ({
  provider,
  storeWrite,
  ldStoreWrite,
  ldStoreRead,
  onSave,
  documentAnnotationsIndex,
  creatorProvider,
}) => (render, onClose) => {
  const [modalStateProvider, modalStateConsumer] = dataPortal<ModalState>();

  const articleSaver = createArticleSaver(storeWrite, ldStoreWrite);
  const [editBarStateOut, editBarStateIn] = dataPortal<EditBarState>();
  const [documentProvider, displayAnnotations] = dataPortal<{
    container: HTMLElement;
    linkedData: LinkedData;
  }>();
  const [mapWithContent, setContent] = statefulMap<LinkedDataWithDocument>();
  const [mapWithContext, setContext, resetEditor] = statefulMap<
    EditorContext
  >();
  const withEditorContext = <T>(
    handler: Callback<
      EditorContext & {
        data: T;
      }
    >
  ): Callback<T> =>
    mapWithContext((data, context) => ({ data, ...context }), handler);

  const saveArticleInner = async (
    context: EditorContext
  ): Promise<LinkedDataWithHashId> => {
    editBarStateIn(["saving"]);
    const { linkedData, container, contentDocument } = context;
    try {
      const newContentDocument = isNew(linkedData)
        ? contentDocument
        : createNewDocument(contentDocument, container);
      const newLinkedData = await articleSaver({
        contentDocument: newContentDocument,
        linkedData,
      });
      const newDocument = {
        linkedData: newLinkedData,
        contentDocument: newContentDocument,
      };
      setContent(newDocument);
      setContext({
        ...newDocument,
        container,
      });
      editBarStateIn(["hidden"]);
      onSave(newLinkedData);
      return newLinkedData;
    } catch (error) {
      return new Promise((resolve) => {
        editBarStateIn([
          "error",
          {
            reason: error,
            onTryAgain: () => saveArticleInner(context).then(resolve),
          },
        ]);
      });
    }
  };

  const saveArticle = (): Promise<LinkedDataWithHashId> => {
    return new Promise((resolve) => {
      withEditorContext<void>((context) => {
        saveArticleInner(context).then(resolve);
      })();
    });
  };

  const getContentReference = (): Promise<HashUri> => {
    return new Promise((resolve) => {
      withEditorContext<void>((context) => {
        const { linkedData } = context;
        const hashUri = findHashUri(linkedData);
        if (hashUri) {
          resolve(hashUri);
        } else {
          saveArticleInner(context).then((newLinkedData) =>
            resolve(throwIfNull(findHashUri(newLinkedData)))
          );
        }
      })();
    });
  };

  const editBarStateUpdater = createEditBarStateUpdater(
    editBarStateIn,
    saveArticle,
    withEditorContext<void>(({ contentDocument, container }) => {
      revertDocument(getDocumentContentRoot(contentDocument), container);
    })
  );

  const [changesProvider, onChange] = dataPortal<
    DocumentChange[] | undefined
  >();

  const [fieldsProvider, linkedDataForFields] = dataPortal<LinkedData>();
  const [selectionProvider, onSelect] = dataPortal<OptSelection>();

  const [contentProvider, documentToDisplay] = dataPortal<{
    content: Document;
    editable: boolean;
  }>();

  provider(
    onClose,
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
      resetEditor,
      ({ linkedData }) => onChange(isEditable(linkedData) ? [] : undefined), // reset change bar
      setContent
    )
  );

  render(
    div(
      { id: "content", class: "ml-4" },
      slot("content-fields", (render) => {
        fieldsProvider(onClose, (linkedData) =>
          render(contentHeaderView(linkedData))
        );
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
        slot(
          "annotation-support",
          annotationsSupport({
            selectionProvider,
            creatorProvider,
            ldStoreWrite,
            ldStoreRead,
            documentProvider,
            getContentReference,
            documentAnnotationsIndex,
          })
        ),
        slot("modal-diff", modal({ provider: modalStateProvider })),
        slot(
          "content",
          contentDisplayComponent({
            provider: contentProvider,
            onChange: fork(onChange, (changes) => {
              editBarStateUpdater({
                visible: Boolean(changes && changes.length > 0),
                newDocument: false,
              });
            }),
            onDisplay: fork(
              mapWithContent(
                (editor, content) => ({
                  container: editor,
                  ...content,
                }),
                fork(
                  setContext,
                  async ({ container, linkedData }) => {
                    displayAnnotations({ container, linkedData });
                  },
                  map(
                    ({ linkedData }) => isNew(linkedData),
                    (newDocument) => {
                      editBarStateUpdater({
                        visible: newDocument,
                        newDocument,
                      });
                    }
                  )
                )
              )
            ),
            onSelect,
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
