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

import { Callback, fork } from "../../../libs/connections";
import { defined, filter } from "../../../libs/connections/filters";
import { map, to } from "../../../libs/connections/mappers";
import {
  button,
  Component,
  div,
  newSlot,
  span,
  View,
  ViewSetup,
} from "../../../libs/simple-ui/render";
import { getTarget } from "../../../libs/simple-ui/utils/funtions";
import { loaderWithContext } from "../../common/loader";
import { ContentComponent, DisplayContext } from "../types";

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
  openPage: (page: number) => void;
  numberOfPages: number;
}> = ({ currentPage, openPage, numberOfPages }) =>
  div(
    { class: "d-flex flex-justify-between flex-items-center" },
    button(
      {
        class: "btn",
        onClick: () => {
          openPage(currentPage - 1);
        },
        disabled: currentPage === 1,
      },
      "previous"
    ),
    span(`${currentPage}/${numberOfPages}`),
    button(
      {
        class: "btn",
        onClick: () => {
          openPage(currentPage + 1);
        },
        disabled: currentPage === numberOfPages,
      },
      "next"
    )
  );

const setupPdfPageView: ViewSetup<
  { openPage: (page: number) => void; onDisplay: Callback<DisplayContext> },
  PdfPage
> = ({ openPage, onDisplay }) => ({
  currentPage,
  canvas,
  textLayer,
  numberOfPages,
}) =>
  div(
    pdfNav({
      currentPage,
      numberOfPages,
      openPage,
    }),
    div(
      { style: { position: "relative" } },
      div({ dangerouslySetDom: canvas }),
      div({
        dangerouslySetDom: textLayer,
        onDisplay: map(getTarget, (container) =>
          onDisplay({ container, fragment: "page=" + currentPage })
        ),
        // onMouseup: onSelectionTrigger,
        // onFocusout: onSelectionTrigger,
      })
    ),
    pdfNav({
      currentPage,
      numberOfPages,
      openPage,
    })
  );

const contentComponent: Component<
  {
    onSelectionTrigger: () => void;
    onPageOpen: Callback<number>;
    onDisplay: Callback<DisplayContext>;
  },
  { renderPage: PdfPage }
> = ({ onPageOpen, onDisplay }) => (render) => {
  const pdfPageView = setupPdfPageView({ openPage: onPageOpen, onDisplay });

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

export const pdfDisplay: ContentComponent = ({
  onSelectionTrigger,
  onDisplay,
}) => (render, onClose) => {
  const [contentSlot, { renderPage }] = newSlot(
    "content",
    contentComponent({
      onSelectionTrigger,
      onDisplay,
      onPageOpen: (it) => {
        load(it);
      },
    })
  );

  const { load, init } = loaderWithContext<
    PdfDocument,
    number,
    PdfPage | undefined
  >({
    fetcher: (pdfDocument, page, signal) => openPage(pdfDocument, page, signal),
    onLoaded: filter(
      defined,
      fork(
        renderPage
        // map(pick("textLayer"), () => {})
      )
    ),
    contentSlot,
  })(render, onClose);

  return {
    displayContent: fork(map(openPdf, init), map(to(1), load)),
  };
};
