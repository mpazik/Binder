import { URL } from "schema-dts";

import {
  getDocumentContentRoot,
  LinkedDataWithDocument,
} from "../../functions/article-processor";
import { DocumentAnnotationsIndex } from "../../functions/indexes/document-annotations-index";
import {
  LinkedDataStoreWrite,
  ResourceStoreWrite,
} from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { combine, Consumer, fork } from "../../libs/connections";
import { filter, nonNull } from "../../libs/connections/filters";
import { map, pick, pipe } from "../../libs/connections/mappers";
import { throwIfNull2 } from "../../libs/errors";
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
  newSlot,
  span,
  View,
} from "../../libs/simple-ui/render";
import { throttleArg } from "../../libs/throttle";
import { annotationsSupport } from "../annotations";
import { currentSelection, OptSelection } from "../annotations/selection";
import {
  articleEditSupport,
  EditorContextWithHash,
  isEditable,
} from "../article-edit";
import {
  DocumentChange,
  newDocumentComparator,
} from "../article-edit/document-change";

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

const contentFields: Component<void, { renderFields: LinkedData }> = () => (
  render
) => ({
  renderFields: (linkedData) => render(contentHeaderView(linkedData)),
});

export const contentDisplayComponent: Component<
  {
    onDisplay: Consumer<HTMLElement>;
    onChange: Consumer<DocumentChange[]>;
    onSelect: Consumer<OptSelection>;
  },
  { displayContent: { content: Document; editable: boolean } }
> = ({ onDisplay, onChange, onSelect }) => (render) => {
  return {
    displayContent: ({ content, editable }) => {
      const contentRoot = getDocumentContentRoot(content);
      let editorElement: HTMLElement | undefined;
      // noinspection JSUnusedGlobalSymbols
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
    },
  };
};

export const editableContentComponent: Component<
  {
    storeWrite: ResourceStoreWrite;
    ldStoreWrite: LinkedDataStoreWrite;
    ldStoreRead: LinkedDataStoreRead;
    onSave: Consumer<LinkedDataWithHashId>;
    documentAnnotationsIndex: DocumentAnnotationsIndex;
  },
  { setCreator: string; setContent: LinkedDataWithDocument }
> = ({
  storeWrite,
  ldStoreWrite,
  ldStoreRead,
  onSave,
  documentAnnotationsIndex,
}) => (render) => {
  const [handleContentDisplayed, setContent] = combine<
    [HTMLElement, LinkedDataWithDocument]
  >(
    fork(
      ([container, { linkedData }]) => {
        displayDocumentAnnotations({ container, linkedData });
      },
      ([container, documentContent]) => {
        setEditorContext({ container, ...documentContent });
      }
    ),
    undefined,
    undefined
  );

  const [
    annotationSupportSlot,
    {
      displaySelectionToolbar,
      displayDocumentAnnotations,
      setCreator,
      setReference,
    },
  ] = newSlot(
    "annotation-support",
    annotationsSupport({
      ldStoreWrite,
      ldStoreRead,
      documentAnnotationsIndex,
      requestDocumentSave: () => saveArticle(),
    })
  );

  const [
    editSupportSlot,
    { setEditorContext, displayChanges, saveArticle },
  ] = newSlot(
    "edit-support",
    articleEditSupport({
      ldStoreWrite,
      storeWrite,
      onSave: fork<EditorContextWithHash>(
        setContent,
        map(pick("linkedData"), onSave),
        map(
          pipe(
            pick("linkedData"),
            findHashUri,
            throwIfNull2(
              () => "save article should have hash uri reference to the content"
            )
          ),
          setReference
        )
      ),
    })
  );

  const [contentSlot, { displayContent }] = newSlot(
    "content",
    contentDisplayComponent({
      onChange: displayChanges,
      onDisplay: handleContentDisplayed,
      onSelect: displaySelectionToolbar,
    })
  );

  const [contentFieldsSlot, { renderFields }] = newSlot(
    "content-fields",
    contentFields()
  );

  render(
    div(
      { id: "content", class: "ml-4" },
      contentFieldsSlot,
      div(
        { id: "editor", class: "mb-3 position-relative" },
        contentSlot,
        editSupportSlot,
        annotationSupportSlot
      )
    )
  );

  return {
    setCreator,
    setContent: fork(
      setContent,
      map(
        ({ contentDocument, linkedData }) => ({
          content: contentDocument,
          editable: isEditable(linkedData),
        }),
        displayContent
      ),
      map(
        pick("linkedData"),
        fork(
          renderFields,
          map((ld) => (isEditable(ld) ? [] : undefined), displayChanges),
          map(findHashUri, filter(nonNull, setReference))
        )
      )
    ),
  };
};
