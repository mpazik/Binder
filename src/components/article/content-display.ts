import * as JSZip from "jszip";

import {
  LinkedDataWithContent,
  LinkedDataWithDocument,
  SavedLinkedDataWithContent,
} from "../../functions/content-processors";
import {
  documentContentRoodId,
  getDocumentContentRoot,
  parseArticleContent,
} from "../../functions/content-processors/html-processor";
import {
  createContentSaver,
  documentToBlob,
} from "../../functions/content-saver";
import {
  LinkedDataStoreWrite,
  ResourceStoreWrite,
} from "../../functions/store";
import {
  Consumer,
  fork,
  passOnlyChanged,
  split,
  splitMap,
  withMultiState,
  withState,
} from "../../libs/connections";
import { filterNonNullTuple } from "../../libs/connections/filters";
import { map, pick, pipe, to } from "../../libs/connections/mappers";
import { getBlobFile, getXmlFile, ZipObject } from "../../libs/epub";
import { throwIfNull } from "../../libs/errors";
import {
  EncodingFormat,
  epubMediaType,
  htmlMediaType,
  isEncodingEqualTo,
  pdfMediaType,
} from "../../libs/ld-schemas";
import { findHashUri, LinkedData } from "../../libs/linked-data";
import { measureAsyncTime } from "../../libs/performance";
import {
  article,
  button,
  Component,
  div,
  newSlot,
} from "../../libs/simple-ui/render";
import { throttleArg } from "../../libs/throttle";
import { currentSelection, OptSelection } from "../annotations/selection";
import { modal } from "../common/modal";
import { pdfContentDisplay } from "../pdf";

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
import { editBar, EditBarState } from "./edit-bar";

const isNew = (linkedData: LinkedData) => !findHashUri(linkedData);
const isEditable: (linkedData: LinkedData) => boolean = () => true;

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

export const contentDisplayComponent: Component<
  {
    storeWrite: ResourceStoreWrite;
    ldStoreWrite: LinkedDataStoreWrite;
    onDisplay: Consumer<HTMLElement>;
    onSelect: Consumer<OptSelection>;
    onSave: Consumer<SavedLinkedDataWithContent>;
  },
  {
    displayContent: LinkedDataWithContent;
    saveContent: void;
  }
> = ({ onDisplay, onSelect, onSave, storeWrite, ldStoreWrite }) => (render) => {
  const contentSaver = createContentSaver(storeWrite, ldStoreWrite);
  const storeData = (data: LinkedDataWithContent, retry: () => void) => {
    try {
      updateEditBar(["saving"]);
      contentSaver(data).then((data) => {
        updateEditBar(["hidden"]);
        onSave(data);
      });
    } catch (reason) {
      updateEditBar(["error", { reason, onTryAgain: retry }]);
    }
  };

  const [sendSelection, setContainerForSelect] = withState<HTMLElement>(
    map(currentSelection, passOnlyChanged(onSelect))
  );

  const [discard, setContextForDiscard] = withState<LinkedDataWithContent>(
    (data) => displayContent(data)
  );

  const [save, setContextForSave] = withState<LinkedDataWithContent>((data) => {
    if (!isNew(data.linkedData))
      throw new Error("Can only save content that was not saved before");
    storeData(data, save);
  });

  const [resetEditBar, setContextForBarReset] = withState<LinkedData>(
    splitMap(
      isNew,
      () => ["visible", { modified: false }] as EditBarState,
      () => ["hidden"] as EditBarState,
      (data) => updateEditBar(data)
    )
  );

  const [
    update,
    [setDocumentForUpdate, setContainerForUpdate],
  ] = withMultiState<[LinkedDataWithDocument, HTMLElement]>(
    filterNonNullTuple(([data, container]) => {
      const { linkedData, contentDocument } = data;
      if (!isEditable(linkedData))
        throw new Error("Can only update content that is editable");

      storeData(
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

  const [editBarSlot, { updateEditBar }] = newSlot(
    "edit-bar",
    editBar({
      onSave: save,
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
  const [pdfDisplaySlot, { updateContent: updatePdfContent }] = newSlot(
    "pdf-display",
    pdfContentDisplay({
      onDisplay: resetEditBar,
      onTextDisplay: setContainerForSelect,
      onSelectionTrigger: sendSelection,
    })
  );

  const displayHtml = async ({
    content,
    linkedData,
  }: LinkedDataWithContent) => {
    const contentDocument = parseArticleContent(await content.text());
    const contentRoot = getDocumentContentRoot(contentDocument);
    if (isEditable(linkedData)) {
      setDocumentForUpdate({ contentDocument, linkedData });
      render(
        div(
          div(
            gutterSlot,
            modalDiffSlot,
            article({
              contenteditable: true,
              class: "editable markdown-body flex-1",
              style: { outline: "none" },
              onInput: detectDocumentChange(
                contentRoot,
                fork(
                  displayChangesOnBar,
                  map(
                    (changes) => Boolean(changes && changes.length > 0),
                    passOnlyChanged(
                      map(
                        (modified) =>
                          (modified
                            ? ["visible", { modified }]
                            : ["hidden"]) as EditBarState,
                        updateEditBar
                      )
                    )
                  )
                )
              ),
              dangerouslySetInnerHTML: contentRoot.innerHTML,
              onMouseup: sendSelection,
              onFocusout: sendSelection,
              onDisplay: map(
                (e) => e.target as HTMLElement,
                fork(
                  onDisplay,
                  setContainerForUpdate,
                  setContainerForSelect,
                  resetEditBar,
                  map(to([]), displayChangesOnBar)
                )
              ),
            })
          ),
          editBarSlot
        )
      );
    } else {
      render(
        div(
          article({
            class: "markdown-body flex-1",
            dangerouslySetInnerHTML: contentRoot.innerHTML,
            onMouseup: sendSelection,
            onFocusout: sendSelection,
            onDisplay: map(
              (e) => e.target as HTMLElement,
              fork(onDisplay, setContainerForSelect, resetEditBar)
            ),
          }),
          editBarSlot
        )
      );
    }
  };

  new Response();

  const displayPdf = ({ content }: LinkedDataWithContent) => {
    render(div(pdfDisplaySlot, editBarSlot));
    updatePdfContent(content);
  };

  function absolute(base: string, relative: string) {
    const separator = "/";
    const stack = base.split(separator),
      parts = relative.split(separator);
    stack.pop(); // remove current file name (or empty string)

    // (omit if "base" is the current folder without trailing slash)
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] == ".") continue;
      if (parts[i] == "..") stack.pop();
      else stack.push(parts[i]);
    }
    return stack.join(separator);
  }

  const prepareEpubPage = async (
    zip: ZipObject,
    file: string
  ): Promise<HTMLElement> => {
    const chapter = await getXmlFile(zip, file);
    const body = chapter.body;

    await Promise.all(
      Array.from(body.getElementsByTagName("img")).map((img) => {
        const src = img.getAttribute("src")!;
        getBlobFile(zip, absolute(file, src)).then((it) =>
          img.setAttribute("src", URL.createObjectURL(it))
        );
      })
    );

    return body;
  };

  const renderChapter = (
    chapter: HTMLElement,
    {
      openChapter,
      currentChapter,
      numberOfChapters,
    }: {
      openChapter: (n: number) => void;
      currentChapter: number;
      numberOfChapters: number;
    }
  ) =>
    render(
      div(
        article({
          class: "markdown-body flex-1",
          dangerouslySetDom: chapter,
          // onMouseup: sendSelection,
          // onFocusout: sendSelection,
          // onDisplay: map(
          //   (e) => e.target as HTMLElement,
          //   fork(onDisplay, setContainerForSelect, resetEditBar)
          // ),
        }),
        button(
          {
            class: "btn",
            onClick: () => {
              openChapter(currentChapter - 1);
            },
            disabled: currentChapter === 1,
          },
          "previous"
        ),
        button(
          {
            class: "btn",
            onClick: () => {
              openChapter(currentChapter + 1);
            },
            disabled: currentChapter === numberOfChapters,
          },
          "next"
        ),
        editBarSlot
      )
    );

  const displayEpub = async ({ content }: LinkedDataWithContent) => {
    const zip = await measureAsyncTime("read pdf metadata", () =>
      JSZip.loadAsync(content)
    )!;

    const container = await getXmlFile(zip, "META-INF/container.xml");

    const rootFile = throwIfNull(
      container.getElementsByTagName("rootfile").item(0)
    );
    const rootDir = "EPUB"; // todo we should compute it from the root file

    console.log(zip);

    const packageDoc = await getXmlFile(
      zip,
      throwIfNull(rootFile.getAttribute("full-path"))
    );

    console.log(packageDoc);
    const spine = packageDoc.getElementsByTagName("spine")[0];
    const spineItems = spine.getElementsByTagName("itemref");

    const openChapter = async (chapterNum: number) => {
      const itemRef = throwIfNull(
        spineItems[chapterNum - 1]?.getAttribute("idref")
      );
      const href = throwIfNull(
        packageDoc.getElementById(itemRef)?.getAttribute("href")
      );
      const document = await prepareEpubPage(zip, rootDir + "/" + href);
      renderChapter(document, {
        openChapter,
        currentChapter: chapterNum,
        numberOfChapters: spineItems.length,
      });
      window.scrollTo(0, 0);
    };

    openChapter(1);
  };

  const displayNotSupported = ({ linkedData }: LinkedDataWithContent) => {
    render(
      div(`Content type ${linkedData["encodingFormat"]} is not supported`)
    );
  };

  const isEncoding = (encoding: EncodingFormat) => ({
    linkedData,
  }: LinkedDataWithContent): boolean => isEncodingEqualTo(encoding)(linkedData);

  const displayContent = split<LinkedDataWithContent>(
    isEncoding(htmlMediaType),
    displayHtml,
    split(
      isEncoding(pdfMediaType),
      displayPdf,
      split(isEncoding(epubMediaType), displayEpub, displayNotSupported)
    )
  );

  return {
    displayContent: fork(
      setContextForDiscard,
      setContextForSave,
      displayContent,
      map(pipe(pick("linkedData")), setContextForBarReset)
    ),
    saveContent: save,
  };
};
