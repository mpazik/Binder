import { documentContentRoodId } from "../../../functions/content-processors/html-processor";
import { documentToBlob } from "../../../functions/content-saver";
import {
  Callback,
  fork,
  passOnlyChanged,
  withMultiState,
  withState,
} from "../../../libs/connections";
import { definedTuple, filter } from "../../../libs/connections/filters";
import { map, pick, to, wrap } from "../../../libs/connections/mappers";
import { Component, div, newSlot } from "../../../libs/simple-ui/render";
import { loader } from "../../common/loader";
import { modal } from "../../common/modal";
import { EditBarState } from "../../content/edit-bar";
import { documentToHtmlContent, processToDocument } from "../html/utils";
import { HtmlContent, setupEditableHtmlView } from "../html/view";
import { AnnotationContext, ContentComponent } from "../types";

import {
  changesIndicatorBar,
  documentChangeTopRelativePosition,
} from "./change-indicator-bar";
import { revertDocumentChange } from "./document-change";
import { renderDocumentChangeModal } from "./document-change-modal";
import { updateBar } from "./update-bar";

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

const contentComponent: Component<
  {
    onSelectionTrigger: () => void;
    onContentModified: Callback<Blob>;
    onDisplay: Callback<AnnotationContext>;
  },
  { renderPage: { doc: Document }; saveComplete: void }
> = ({ onDisplay, onSelectionTrigger, onContentModified }) => (render) => {
  const updateData = (newContent: Blob, retry: () => void) => {
    try {
      updateUpdateBar(["saving"]);
      onContentModified(newContent);
    } catch (reason) {
      updateUpdateBar(["error", { reason, onTryAgain: retry }]);
    }
  };

  const [discard, setContextForDiscard] = withState<HtmlContent>((data) =>
    displayContent(data)
  );

  const [
    update,
    [setDocumentForUpdate, setContainerForUpdate],
  ] = withMultiState<[Document, HTMLElement]>(
    filter(definedTuple, ([contentDocument, container]) => {
      updateData(
        documentToBlob(createNewDocument(contentDocument, container)),
        update
      );
    }),
    undefined,
    undefined
  );

  const [updateBarSlot, { updateUpdateBar }] = newSlot(
    "update-bar",
    updateBar({
      onUpdate: update,
      onDiscard: discard,
    })
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

  const editableHtmlView = setupEditableHtmlView({
    onSelectionTrigger,
    onDocumentChange: fork(
      displayChangesOnBar,
      map(
        (changes) => Boolean(changes && changes.length > 0),
        passOnlyChanged(
          map(
            (modified) => (modified ? ["visible"] : ["hidden"]) as EditBarState,
            updateUpdateBar
          )
        )
      )
    ),
    onDisplay: fork(
      map(wrap("container"), onDisplay),
      setContainerForUpdate,
      map(to([]), displayChangesOnBar)
    ),
  });

  const displayContent: Callback<HtmlContent> = map(
    ({ content }) =>
      div(
        div(
          gutterSlot,
          modalDiffSlot,
          editableHtmlView({
            content,
          })
        ),
        updateBarSlot
      ),
    render
  );

  return {
    renderPage: map(
      pick("doc"),
      fork(
        map(documentToHtmlContent, fork(displayContent, setContextForDiscard)),
        setDocumentForUpdate
      )
    ),
    saveComplete: () => updateUpdateBar(["hidden"]),
  };
};

export const htmlEditableDisplay: ContentComponent = ({
  onContentModified,
  onDisplay,
  onSelectionTrigger,
}) => (render, onClose) => {
  const [contentSlot, { renderPage, saveComplete }] = newSlot(
    "editable-html-content",
    contentComponent({
      onSelectionTrigger,
      onContentModified,
      onDisplay: onDisplay,
    })
  );

  const { load } = loader<Blob, { doc: Document }>({
    fetcher: (it) => processToDocument(it).then(wrap("doc")),
    onLoaded: renderPage,
    contentSlot,
  })(render, onClose);

  return {
    displayContent: load,
    saveComplete,
  };
};
