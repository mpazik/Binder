import "./style.css";

import type { Callback } from "linki";
import {
  cast,
  defined,
  definedTuple,
  filter,
  fork,
  link,
  map,
  passOnlyChanged,
  pick,
  to,
  withOptionalState,
  wrap,
} from "linki";
import type { UiComponent } from "linki-ui";
import { div, dom, mountComponent, renderJsonHtmlToDom } from "linki-ui";

import {
  documentContentRoodId,
  getDocumentContentRoot,
} from "../../../functions/content-processors/html-processor";
import { documentToBlob } from "../../../functions/content-processors/html-processor/utils";
import { withMultiState } from "../../../libs/linki";
import { loader } from "../../common/loader";
import { modal } from "../../common/modal";
import type { EditBarState } from "../../content/edit-bar";
import {
  processToDocument,
  scrollToPageTopWhenNoFragment,
} from "../html/utils";
import { editableHtmlView } from "../html/view";
import type { ContentComponent, DisplayContext } from "../types";

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

const contentComponent: UiComponent<
  { renderPage: { doc: Document }; saveComplete: void },
  {
    onContentModified: Blob;
    onDisplay: DisplayContext;
  }
> = ({ onDisplay, onContentModified, render }) => {
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
    withOptionalState<Node>(),
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

  const [updateBarSlot, { updateUpdateBar }] = mountComponent(updateBar, {
    onUpdate: update,
    onDiscard: discard,
  });

  const [gutterSlot, { displayChangesOnBar }] = mountComponent(
    changesIndicatorBar,
    {
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
    }
  );

  const [modalDiffSlot, { displayModal }] = mountComponent(modal);

  const displayContent: Callback<Node> = link(
    map(
      (content) =>
        editableHtmlView({
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
          content,
        }),
      renderJsonHtmlToDom,
      cast<Node, HTMLElement>()
    ),
    fork(
      link(
        map((container) => [
          div(gutterSlot, modalDiffSlot, dom(container)),
          updateBarSlot,
        ]),
        render
      ),
      fork(
        link(map(wrap("container")), onDisplay),
        setContainerForUpdate,
        link(map(to([])), displayChangesOnBar)
      )
    )
  );

  return {
    renderPage: link(
      map(pick("doc")),
      fork(
        link(
          map(getDocumentContentRoot),
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
  render,
}) => {
  const [contentSlot, { renderPage, saveComplete }] = mountComponent(
    contentComponent,
    {
      onContentModified,
      onDisplay: fork(onDisplay, scrollToPageTopWhenNoFragment),
    }
  );

  const { load, stop } = loader<Blob, { doc: Document }>({
    fetcher: (it) => processToDocument(it).then(wrap("doc")),
    onLoaded: renderPage,
    contentSlot,
  })({ render });

  return {
    stop,
    displayContent: link(map(pick("content")), load),
    goToFragment: () => {
      // handled by browser
    },
    saveComplete,
  };
};
