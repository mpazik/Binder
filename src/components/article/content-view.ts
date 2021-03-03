import { URL } from "schema-dts";

import {
  documentContentRoodId,
  getDocumentContentRoot,
  LinkedDataWithDocument,
} from "../../functions/article-processor";
import {
  ArticleSaver,
  createArticleSaver,
} from "../../functions/article-saver";
import {
  LinkedDataStoreWrite,
  ResourceStoreWrite,
} from "../../functions/store";
import { Consumer, dataPortal, fork, Provider } from "../../libs/connections";
import {
  Callback,
  filterNonNull,
  map,
  splitOnUndefined,
  statefulMap,
  withValue,
} from "../../libs/connections/processors2";
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
import { modal, ModalState } from "../common/modal";

import { Annotation, annotation, createAnnotation } from "./annotation";
import {
  changesIndicatorBar,
  documentChangeTopRelativePosition,
} from "./change-indicator-bar";
import {
  commentDisplay,
  CommentDisplayState,
  commentForm,
  WithContainerContext,
} from "./comment";
import {
  DocumentChange,
  newDocumentComparator,
  revertDocument,
  revertDocumentChange,
} from "./document-change";
import { renderDocumentChangeModal } from "./document-change-modal";
import { editBar, EditBarState } from "./edit-bar";
import { quoteSelectorForSelection, renderSelector } from "./highlights";
import { currentSelection, selectionToolbar } from "./selection-toolbar";
import { throwIfNull } from "../../libs/errors";
import { DocumentAnnotationsIndex } from "../../functions/indexes/document-annotations-index";
import { LinkedDataStoreRead } from "../../functions/store/local-store";

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
  onSelect: Consumer<Range | undefined>;
}> = ({ provider, onDisplay, onChange, onSelect }) => (render) => {
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
        onMouseup: () => onSelect(currentSelection()),
        onFocusout: () => {
          console.log("focus out");
          onSelect(undefined);
        },
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
  text: string;
};

export const editableContentComponent: Component<{
  provider: Provider<LinkedDataWithDocument>;
  storeWrite: ResourceStoreWrite;
  ldStoreWrite: LinkedDataStoreWrite;
  ldStoreRead: LinkedDataStoreRead;
  onSave: Consumer<LinkedDataWithHashId>;
  documentAnnotationsIndex: DocumentAnnotationsIndex;
}> = ({
  provider,
  storeWrite,
  ldStoreWrite,
  ldStoreRead,
  onSave,
  documentAnnotationsIndex,
}) => (render) => {
  const [modalStateProvider, modalStateConsumer] = dataPortal<ModalState>();

  const [editBarStateOut, editBarStateIn] = dataPortal<EditBarState>();
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

  const articleSaverLinkedWithEditBar: ArticleSaver = (articleContent) => {
    editBarStateIn(["saving"]);
    return createArticleSaver(
      storeWrite,
      ldStoreWrite
    )(articleContent)
      .then((data) => {
        onSave(data);
        editBarStateIn(["hidden"]);
        return data;
      })
      .catch((error) => {
        editBarStateIn([
          "error",
          {
            reason: error,
            onTryAgain: () => articleSaverLinkedWithEditBar(articleContent),
          },
        ]);
        throw error;
      });
  };

  const editBarStateUpdater = createEditBarStateUpdater(
    editBarStateIn,
    () => {
      withEditorContext<void>(({ linkedData, contentDocument, container }) => {
        articleSaverLinkedWithEditBar({
          contentDocument: createNewDocument(contentDocument, container),
          linkedData,
        });
      })();
    },
    () => {
      withEditorContext<void>(({ contentDocument, container }) => {
        revertDocument(getDocumentContentRoot(contentDocument), container);
      });
    }
  );

  const getContentReference = ({
    linkedData,
    contentDocument,
  }: LinkedDataWithDocument): Promise<HashUri> => {
    const hashUri = findHashUri(linkedData);
    if (hashUri) {
      return Promise.resolve(hashUri);
    } else {
      return articleSaverLinkedWithEditBar({
        contentDocument,
        linkedData,
      }).then((newLinkedData) => throwIfNull(findHashUri(newLinkedData)));
    }
  };

  const saveAnnotation = async (
    container: HTMLElement,
    content: LinkedDataWithDocument,
    text: string,
    annotation: Annotation
  ) => {
    try {
      annotation.target.source = await getContentReference(content);
      await ldStoreWrite(annotation);
      console.log("annotation", annotation);
      displayAnnotation(container, text, annotation);
    } catch (e) {
      console.error(e);
    }
  };

  const displayAnnotation = (
    container: HTMLElement,
    text: string,
    annotation: Annotation
  ) =>
    renderSelector(
      container,
      text,
      annotation.target.selector,
      annotation.body
        ? map(
            (position) =>
              [
                "visible",
                { content: annotation.body?.value, position },
              ] as CommentDisplayState,
            displayComment
          )
        : undefined,
      annotation.body ? withValue(["hidden"], displayComment) : undefined
    );

  const [changesProvider, onChange] = dataPortal<
    DocumentChange[] | undefined
  >();

  const [fieldsProvider, linkedDataForFields] = dataPortal<LinkedData>();
  const [rangeProvider, onSelect] = dataPortal<
    WithContainerContext<Range> | undefined
  >();
  const [commentFormProvider, displayCommentForm] = dataPortal<
    WithContainerContext<Range>
  >();
  const [commentToDisplayProvider, displayComment] = dataPortal<
    CommentDisplayState
  >();
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
      resetEditor,
      ({ linkedData }) => onChange(isEditable(linkedData) ? [] : undefined), // reset change bar
      setContent
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
          "comment-form",
          commentForm({
            commentFormProvider,
            onCreatedComment: withEditorContext(
              ({ data, contentDocument, linkedData, container, text }) =>
                saveAnnotation(
                  container,
                  { linkedData, contentDocument },
                  text,
                  data
                )
            ),
          })
        ),
        slot(
          "comment-display",
          commentDisplay({ commentProvider: commentToDisplayProvider })
        ),
        slot(
          "selection-toolbar",
          selectionToolbar({
            rangeProvider,
            buttons: [
              {
                handler: withEditorContext(displayCommentForm),
                label: "comment",
              },
              {
                handler: withEditorContext(
                  ({ container, contentDocument, linkedData, data, text }) =>
                    saveAnnotation(
                      container,
                      { contentDocument, linkedData },
                      text,
                      createAnnotation(
                        "something",
                        quoteSelectorForSelection(container, text, data)
                      )
                    )
                ),
                label: "highlight",
              },
            ],
          })
        ),
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
                  text: editor?.textContent || "",
                  ...content,
                }),
                fork(
                  setContext,
                  async ({ container, text, linkedData }) => {
                    const documentHashUri = findHashUri(linkedData);
                    if (!documentHashUri) return;
                    const annotationsHashUris = await documentAnnotationsIndex({
                      documentHashUri,
                    });
                    const annotations = await Promise.all(
                      annotationsHashUris.map(ldStoreRead)
                    );
                    annotations.forEach(
                      filterNonNull((annotation) => {
                        displayAnnotation(
                          container,
                          text,
                          (annotation as unknown) as Annotation
                        );
                      })
                    );
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
            onSelect: splitOnUndefined(onSelect, withEditorContext(onSelect)),
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
