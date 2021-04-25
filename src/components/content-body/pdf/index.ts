import * as pdfJsLib from "pdfjs-dist";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { TextLayerBuilder } from "pdfjs-dist/lib/web/text_layer_builder.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line import/order
import { EventBus } from "pdfjs-dist/lib/web/ui_utils.js";
import "./text_layer_builder.css";

import { PDFDocumentProxy } from "pdfjs-dist/types/display/api";

import { Callback, fork, withMultiState } from "../../../libs/connections";
import { defined, filter } from "../../../libs/connections/filters";
import {
  map,
  passUndefined,
  pick,
  pipe,
  withDefaultValue,
} from "../../../libs/connections/mappers";
import {
  a,
  Component,
  div,
  newSlot,
  span,
  View,
  ViewSetup,
} from "../../../libs/simple-ui/render";
import { getTarget } from "../../../libs/simple-ui/utils/funtions";
import { createPdfFragment } from "../../annotations/annotation";
import { loaderWithContext } from "../../common/loader";
import { ContentComponent, DisplayContext } from "../types";
import { scrollToTop } from "../utils";

// The workerSrc property shall be specified.
pdfJsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.js";

type PdfDocument = PDFDocumentProxy;
type PdfPage = {
  canvas: HTMLElement;
  textLayer: HTMLElement;
  currentPage: number;
  numberOfPages: number;
};

const openPage = async (
  pdfDocument: PdfDocument,
  pageNumber: number,
  abortSignal: AbortSignal
): Promise<PdfPage | undefined> => {
  const containerWidth = 696;
  let canceled = false;
  abortSignal.addEventListener("abort", () => (canceled = true));

  const canvas = document.createElement("canvas");
  const textLayer = document.createElement("div");
  textLayer.classList.add("textLayer");

  const page = await pdfDocument.getPage(pageNumber);
  if (canceled) return;
  const textContent = await page.getTextContent();
  if (canceled) return;

  const originalViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: containerWidth / originalViewport.width,
  });
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  textLayer.style.width = viewport.width + "px";
  textLayer.style.height = viewport.height + "px";

  await page.render({
    canvasContext: canvas.getContext("2d")!,
    viewport: viewport,
  });
  if (canceled) return;

  const textLayerObj = new TextLayerBuilder({
    textLayerDiv: textLayer,
    pageIndex: page._pageIndex,
    viewport: viewport,
    eventBus: new EventBus(),
  });
  textLayerObj.setTextContent(textContent);
  textLayerObj.render();

  return {
    canvas,
    textLayer,
    currentPage: pageNumber,
    numberOfPages: pdfDocument.numPages,
  };
};

const pdfNav: View<{
  currentPage: number;
  numberOfPages: number;
}> = ({ currentPage, numberOfPages }) =>
  div(
    { class: "d-flex flex-justify-between flex-items-center" },
    a(
      {
        href: `#page=${currentPage - 1}`,
        style: { visibility: currentPage === 1 ? "hidden" : "visible" },
      },
      "← previous"
    ),
    span(`${currentPage}/${numberOfPages}`),
    a(
      {
        href: `#page=${currentPage + 1}`,
        style: {
          visibility: currentPage === numberOfPages ? "hidden" : "visible",
        },
      },
      "next →"
    )
  );

const setupPdfPageView: ViewSetup<
  {
    onDisplay: Callback<DisplayContext>;
  },
  PdfPage
> = ({ onDisplay }) => ({ currentPage, canvas, textLayer, numberOfPages }) =>
  div(
    pdfNav({
      currentPage,
      numberOfPages,
    }),
    div(
      {
        class: "position-relative",
        onDisplay: map(getTarget, (container) =>
          onDisplay({
            container,
            fragmentForAnnotations: createPdfFragment("page=" + currentPage),
            fragment: "page=" + currentPage,
          })
        ),
      },
      div({ dangerouslySetDom: canvas }),
      div({
        dangerouslySetDom: textLayer,
      })
    ),
    pdfNav({
      currentPage,
      numberOfPages,
    })
  );

const contentComponent: Component<
  {
    onDisplay: Callback<DisplayContext>;
  },
  { renderPage: PdfPage }
> = ({ onDisplay }) => (render) => {
  const pdfPageView = setupPdfPageView({
    onDisplay,
  });

  return {
    renderPage: map(pdfPageView, render),
  };
};

const openPdf = (content: Blob): Promise<PdfDocument> =>
  content.arrayBuffer().then(
    (data) =>
      pdfJsLib.getDocument({
        data: new Uint8Array(data),
      }).promise
  );

const parsePageFragment = (fragment: string): number | undefined => {
  const parsePageFragmentRaw = (fragment: string): number | undefined => {
    if (!fragment.startsWith("page=")) return;
    try {
      return Number.parseInt(fragment.substring(5));
    } catch (e) {
      return undefined;
    }
  };

  const page = parsePageFragmentRaw(fragment);
  if (page) {
    return page;
  }
  console.error(`Could not parse page number from ${fragment}`);
};

export const pdfDisplay: ContentComponent = ({ onDisplay }) => (
  render,
  onClose
) => {
  const [contentSlot, { renderPage }] = newSlot(
    "content",
    contentComponent({
      onDisplay: fork(onDisplay, map(pick("container"), scrollToTop)),
    })
  );

  const [changePage, [setPage]] = withMultiState<[PdfPage], KeyboardEvent>(
    ([page], keyboardEvent) => {
      if (!page) return;
      if (keyboardEvent.key === "ArrowLeft" && page.currentPage > 1) {
        load(page.currentPage - 1);
      } else if (
        keyboardEvent.key === "ArrowRight" &&
        page.currentPage < page.numberOfPages
      ) {
        load(page.currentPage + 1);
      }
    },
    undefined
  );

  const { load, init } = loaderWithContext<
    PdfDocument,
    number,
    PdfPage | undefined
  >({
    fetcher: (pdfDocument, page, signal) => openPage(pdfDocument, page, signal),
    onLoaded: filter(defined, fork(renderPage, setPage)),
    contentSlot,
  })(render, onClose);

  document.addEventListener("keyup", changePage);
  onClose(() => document.removeEventListener("keyup", changePage));

  return {
    displayContent: fork(
      map(pipe(pick("content"), openPdf), init),
      map(
        pipe(
          pick("fragment"),
          passUndefined(parsePageFragment),
          withDefaultValue(1)
        ),
        load
      )
    ),
    goToFragment: map(parsePageFragment, filter(defined, load)),
  };
};
