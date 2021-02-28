import { URL } from "schema-dts";

import {
  documentContentRoodId,
  getDocumentContentRoot,
  LinkedDataWithDocument,
} from "../../functions/article-processor";
import { ArticleSaver } from "../../functions/article-saver";
import { Consumer, dataPortal, fork, Provider } from "../../libs/connections";
import {
  Callback,
  map,
  withValue,
  statefulMap,
  splitOnUndefined,
} from "../../libs/connections/processors2";
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
  articleSaver: ArticleSaver,
  onSave: (value: LinkedDataWithHashId) => void
) => ({
  visible,
  content,
  editor,
}: {
  visible: boolean;
  editor?: HTMLElement;
  content?: LinkedDataWithDocument;
}) => {
  if (!visible) {
    editBarStateIn(["hidden"]);
  } else if (editor && content) {
    const { contentDocument, linkedData } = content;
    const saveDocument = () => {
      articleSaver({
        contentDocument: createNewDocument(contentDocument, editor),
        linkedData,
      })
        .then((data) => {
          editBarStateIn(["hidden"]);
          onSave(data);
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
      revertDocument(getDocumentContentRoot(contentDocument), editor);

    editBarStateIn([
      "visible",
      {
        onSave: saveDocument,
        onDiscard: isNew(linkedData) ? undefined : discard,
      },
    ]);
  }
};

export const editableContentComponent: Component<{
  provider: Provider<LinkedDataWithDocument>;
  articleSaver: ArticleSaver;
  onSave: Consumer<LinkedDataWithHashId>;
}> = ({ provider, articleSaver, onSave }) => (render) => {
  const [modalStateProvider, modalStateConsumer] = dataPortal<ModalState>();

  const [editBarStateOut, editBarStateIn] = dataPortal<EditBarState>();
  const [mapWithEditor, setEditor, resetEditor] = statefulMap<HTMLElement>();
  const [mapWithContent, setContent] = statefulMap<LinkedDataWithDocument>();
  const [mapWithContentText, setContentText] = statefulMap<{
    container: HTMLElement;
    text: string;
  }>();
  const [editBarVisible, setEditBarVisible] = dataPortal<boolean>();
  const editBarStateUpdater = createEditBarStateUpdater(
    editBarStateIn,
    articleSaver,
    onSave
  );

  editBarVisible(
    mapWithContent(
      (visible, content) => ({
        content,
        visible,
      }),
      mapWithEditor(
        (props, editor) => ({ ...props, editor }),
        editBarStateUpdater
      )
    )
  );

  const saveAnnotation = (
    container: HTMLElement,
    text: string,
    annotation: Annotation
  ) => {
    console.log("Saving...", annotation);
    displayAnnotation(container, text, annotation);
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

  const withEditorContext = <T>(
    handler: Callback<WithContainerContext<T>>
  ): Callback<T> =>
    mapWithContentText(
      (data, { container, text }) => ({ data, text, container }),
      handler
    );

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
            onCreatedComment: withEditorContext(({ data, container, text }) =>
              saveAnnotation(container, text, data)
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
                handler: withEditorContext(({ container, data, text }) =>
                  saveAnnotation(
                    container,
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
            onChange: fork(onChange, (changes) =>
              setEditBarVisible((changes && changes.length > 0) ?? false)
            ),
            onDisplay: fork(
              setEditor,
              (editor) => {
                const container = editor;
                const text = container?.textContent || "";
                setContentText({
                  container,
                  text,
                });
                displayAnnotation(container, text, annotation);
              },
              mapWithContent(
                (_, { linkedData }) => isNew(linkedData),
                setEditBarVisible
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
