import { URL } from "schema-dts";

import {
  documentContentRoodId,
  getDocumentContentRoot,
  LinkedDataWithDocument,
} from "../../functions/article-processor";
import { ArticleSaver } from "../../functions/article-saver";
import {
  Consumer,
  dataPortal,
  fork,
  passOnlyChanged,
  Provider,
} from "../../libs/connections";
import { map, statefulMap } from "../../libs/connections/processors2";
import {
  findHashUri,
  findUrl,
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/linked-data";
import {
  a,
  article,
  button,
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
import { addComment, annotation } from "./highlights";
import {
  currentSelection,
  offsetSelection,
  Selection,
  selectionToolbar,
} from "./selection-toolbar";

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
  onSelect: Consumer<Selection | undefined>;
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

const commentFormView: View<{ top: number }> = ({ top }) =>
  div(
    { class: "Box position-absolute", style: { top } },
    div(
      { class: "Box-body p-1" },
      div({
        class: "form-control p-1",
        style: { "min-height": "80px", width: "200px" },
        contenteditable: true,
        onDisplay: (event) => (event.target as HTMLInputElement).focus(),
      })
    ),
    div(
      { class: "Box-footer text-right p-1" },
      button(
        { type: "button", class: "btn btn-sm btn-secondary mr-1" },
        "Cancel"
      ),
      button({ type: "button", class: "btn btn-sm btn-primary" }, "Save")
    )
  );

const commentForm: Component<{
  commentFormProvider: Provider<{ top: number }>;
}> = ({ commentFormProvider }) => (render) => {
  commentFormProvider(({ top }) => {
    render(commentFormView({ top }));
  });
};

const isNew = (linkedData: LinkedData) => !findHashUri(linkedData);
// eslint-disable-next-line unused-imports/no-unused-vars-ts,@typescript-eslint/no-unused-vars
const isEditable = (linkedData: LinkedData) => false;

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
  const [mapWithEditor, setEditor] = statefulMap<HTMLElement | undefined>();
  const [mapWithContent, setContent] = statefulMap<LinkedDataWithDocument>();
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

  const [changesProvider, onChange] = dataPortal<
    DocumentChange[] | undefined
  >();

  const [fieldsProvider, linkedDataForFields] = dataPortal<LinkedData>();
  const [selectionProvider, onSelect] = dataPortal<Selection | undefined>();
  const [commentFormProvider, onAddComment] = dataPortal<{ top: number }>();
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
      () => setEditor(undefined),
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
        slot("comment-form", commentForm({ commentFormProvider })),
        slot(
          "selection-toolbar",
          selectionToolbar({
            selectionProvider,
            onAddComment,
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
              mapWithContent(
                (_, content) => (content ? isNew(content.linkedData) : false),
                setEditBarVisible
              ),
              (editor) => {
                if (!editor) return;
                addComment(editor, annotation);
              }
            ),
            onSelect: mapWithEditor((selection, element) => {
              if (!selection || !element) return undefined;
              return offsetSelection(element, selection);
            }, onSelect),
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
