import {
  LinkedDataWithContent,
  LinkedDataWithDocument,
} from "../../../functions/content-processors";
import {
  documentContentRoodId,
  getDocumentContentRoot,
  parseArticleContent,
} from "../../../functions/content-processors/html-processor";
import { ContentSaver, documentToBlob } from "../../../functions/content-saver";
import {
  Consumer,
  fork,
  passOnlyChanged,
  withMultiState,
  withState,
} from "../../../libs/connections";
import { definedTuple, filter } from "../../../libs/connections/filters";
import { ignore, map, mapAwait, to } from "../../../libs/connections/mappers";
import { Component, div, newSlot } from "../../../libs/simple-ui/render";
import { throttleArg } from "../../../libs/throttle";
import { AnnotationDisplayRequest } from "../../annotations";
import { modal } from "../../common/modal";
import { EditBarState } from "../../content/edit-bar";
import { editableHtmlView } from "../html-view";

import {
  changesIndicatorBar,
  documentChangeTopRelativePosition,
} from "./change-indicator-bar";
import {
  DocumentChange,
  newDocumentComparator,
  revertDocumentChange,
} from "./document-change";
import { renderDocumentChangeModal } from "./document-change-modal";
import { updateBar } from "./update-bar";

// ideally should be triggered on resize too
const detectDocumentChange = (
  contentRoot: HTMLElement,
  onChange: (c: DocumentChange[]) => void
) => (e: InputEvent) =>
  throttleArg<Element>(
    map(newDocumentComparator(contentRoot), onChange),
    300
  )(e.target as HTMLElement);

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

export const htmlEdiableDisplay: Component<
  {
    contentSaver: ContentSaver;
    onAnnotationDisplayRequest: Consumer<AnnotationDisplayRequest>;
    onSelectionTrigger: () => void;
  },
  { displayContent: LinkedDataWithContent }
> = ({ contentSaver, onAnnotationDisplayRequest, onSelectionTrigger }) => (
  render
) => {
  const updateData = (data: LinkedDataWithContent, retry: () => void) => {
    try {
      updateUpdateBar(["saving"]);
      contentSaver(data).then(() => {
        updateUpdateBar(["hidden"]);
      });
    } catch (reason) {
      updateUpdateBar(["error", { reason, onTryAgain: retry }]);
    }
  };

  const [discard, setContextForDiscard] = withState<LinkedDataWithContent>(
    (data) => displayContent(data)
  );

  const [
    update,
    [setDocumentForUpdate, setContainerForUpdate],
  ] = withMultiState<[LinkedDataWithDocument, HTMLElement]>(
    filter(definedTuple, ([data, container]) => {
      const { linkedData, contentDocument } = data;
      updateData(
        {
          linkedData,
          content: documentToBlob(
            createNewDocument(contentDocument, container)
          ),
        },
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

  const displayContent = mapAwait<
    LinkedDataWithContent,
    LinkedDataWithDocument
  >(
    async ({ content, linkedData }) => {
      return {
        linkedData,
        contentDocument: parseArticleContent(await content.text()),
      };
    },
    fork(setDocumentForUpdate, ({ contentDocument, linkedData }) => {
      const contentRoot = getDocumentContentRoot(contentDocument);
      render(
        div(
          div(
            gutterSlot,
            modalDiffSlot,
            editableHtmlView({
              content: contentRoot,
              onInput: detectDocumentChange(
                contentRoot,
                fork(
                  displayChangesOnBar,
                  map(
                    (changes) => Boolean(changes && changes.length > 0),
                    passOnlyChanged(
                      map(
                        (modified) =>
                          (modified ? ["visible"] : ["hidden"]) as EditBarState,
                        updateUpdateBar
                      )
                    )
                  )
                )
              ),
              onDisplay: fork(
                (container) =>
                  onAnnotationDisplayRequest({ container, linkedData }),
                setContainerForUpdate,
                map(to([]), displayChangesOnBar)
              ),
              sendSelection: onSelectionTrigger,
            })
          ),
          updateBarSlot
        )
      );
    }),
    ignore
  );

  return {
    displayContent: fork(displayContent, setContextForDiscard),
  };
};
