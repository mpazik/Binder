import "./style.css";

import type { Callback } from "linki";
import {
  definedTuple,
  filter,
  map,
  pick,
  to,
  wrap,
  fork,
  passOnlyChanged,
  link,
  withOptionalState,
  defined,
} from "linki";

import { documentContentRoodId } from "../../../functions/content-processors/html-processor";
import { documentToBlob } from "../../../functions/content-processors/html-processor/utils";
import { withMultiState } from "../../../libs/linki";
import type { Component } from "../../../libs/simple-ui/render";
import { div, newSlot } from "../../../libs/simple-ui/render";
import { loader } from "../../common/loader";
import { modal } from "../../common/modal";
import type { EditBarState } from "../../content/edit-bar";
import {
  documentToHtmlContent,
  processToDocument,
  scrollToPageTopWhenNoFragment,
} from "../html/utils";
import type { HtmlContent } from "../html/view";
import { setupEditableHtmlView } from "../html/view";
import type { DisplayContext, ContentComponent } from "../types";

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
    onContentModified: Callback<Blob>;
    onDisplay: Callback<DisplayContext>;
  },
  { renderPage: { doc: Document }; saveComplete: void }
> = ({ onDisplay, onContentModified }) => (render) => {
  const updateData = (newContent: Blob, retry: () => void) => {
    try {
      updateUpdateBar(["saving"]);
      onContentModified(newContent);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      updateUpdateBar(["error", { reason, onTryAgain: retry }]);
    }
  };

  const [discard, setContextForDiscard] = link(
    withOptionalState<HtmlContent>(),
    filter(defined),
    (data) => displayContent(data)
  );

  const [update, setDocumentForUpdate, setContainerForUpdate] = link(
    withMultiState<[Document, HTMLElement]>(undefined, undefined),
    filter(definedTuple),
    ([contentDocument, container]) => {
      updateData(
        documentToBlob(createNewDocument(contentDocument, container)),
        update
      );
    }
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
    onDocumentChange: fork(
      displayChangesOnBar,
      link(
        map((changes) => Boolean(changes && changes.length > 0)),
        passOnlyChanged(),
        map(
          (modified: boolean) =>
            (modified ? ["visible"] : ["hidden"]) as EditBarState
        ),
        updateUpdateBar
      )
    ),
    onDisplay: fork(
      link(map(wrap("container")), onDisplay),
      setContainerForUpdate,
      link(map(to([])), displayChangesOnBar)
    ),
  });

  const displayContent: Callback<HtmlContent> = link(
    map(({ content }) =>
      div(
        div(
          gutterSlot,
          modalDiffSlot,
          editableHtmlView({
            content,
          })
        ),
        updateBarSlot
      )
    ),
    render
  );

  return {
    renderPage: link(
      map(pick("doc")),
      fork(
        link(
          map(documentToHtmlContent),
          fork(displayContent, setContextForDiscard)
        ),
        setDocumentForUpdate
      )
    ),
    saveComplete: () => updateUpdateBar(["hidden"]),
  };
};

export const htmlEditableDisplay: ContentComponent = ({
  onContentModified,
  onDisplay,
}) => (render, onClose) => {
  const [contentSlot, { renderPage, saveComplete }] = newSlot(
    "editable-html-content",
    contentComponent({
      onContentModified,
      onDisplay: fork(onDisplay, scrollToPageTopWhenNoFragment),
    })
  );

  const { load } = loader<Blob, { doc: Document }>({
    fetcher: (it) => processToDocument(it).then(wrap("doc")),
    onLoaded: renderPage,
    contentSlot,
  })(render, onClose);

  return {
    displayContent: link(map(pick("content")), load),
    goToFragment: () => {
      // handled by browser
    },
    saveComplete,
  };
};
