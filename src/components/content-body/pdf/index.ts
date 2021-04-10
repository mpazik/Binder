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

import { LinkedDataWithContent } from "../../../functions/content-processors";
import { Callback, Consumer, fork } from "../../../libs/connections";
import { defined, filter } from "../../../libs/connections/filters";
import {
  button,
  Component,
  div,
  newSlot,
  span,
  View,
} from "../../../libs/simple-ui/render";
import { AnnotationDisplayRequest } from "../../annotations";
import { loader } from "../../common/loader";

// The workerSrc property shall be specified.
pdfJsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.js";

type PdfDocument = Promise<PDFDocumentProxy>;
type PageOpenRequest = { page: number; pdfDocument: PdfDocument };

type PdfPage = {
  canvas: HTMLElement;
  textLayer: HTMLElement;
  pdfDocument: PdfDocument;
  currentPage: number;
  numberOfPages: number;
};

const openPage = async (
  pdfDocument: PdfDocument,
  pageNumber: number,
  abortSignal: AbortSignal
): Promise<PdfPage | undefined> => {
  const containerWidth = 696;
  const pdf = await pdfDocument;
  let canceled = false;
  abortSignal.addEventListener("abort", () => (canceled = true));

  const canvas = document.createElement("canvas");
  const textLayer = document.createElement("div");
  textLayer.classList.add("textLayer");

  const page = await pdf.getPage(pageNumber);
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
    pdfDocument,
    numberOfPages: pdf.numPages,
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

const contentComponent: Component<
  {
    onSelectionTrigger: () => void;
    onPageOpen: Callback<PageOpenRequest>;
  },
  { renderPage: PdfPage }
> = ({ onSelectionTrigger, onPageOpen }) => (render) => {
  return {
    renderPage: ({
      canvas,
      textLayer,
      pdfDocument,
      currentPage,
      numberOfPages,
    }) => {
      const openPage = (page: number) => {
        onPageOpen({ page, pdfDocument });
      };
      render(
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
              // onMouseup: onSelectionTrigger,
              // onFocusout: onSelectionTrigger,
            })
          ),
          pdfNav({
            currentPage,
            numberOfPages,
            openPage,
          })
        )
      );
    },
  };
};

const openPdf = (content: Blob): PdfDocument =>
  content.arrayBuffer().then(
    (data) =>
      pdfJsLib.getDocument({
        data: new Uint8Array(data),
      }).promise
  );

export const pdfDisplay: Component<
  {
    onAnnotationDisplayRequest: Consumer<AnnotationDisplayRequest>;
    onSelectionTrigger: () => void;
  },
  { displayContent: LinkedDataWithContent }
> = ({ onSelectionTrigger }) => (render) => {
  const [contentSlot, { renderPage }] = newSlot(
    "content",
    contentComponent({
      onSelectionTrigger,
      onPageOpen: (it) => {
        load(it);
      },
    })
  );

  const [pdfSlot, { load }] = newSlot(
    "pdf-loader",
    loader<PageOpenRequest, PdfPage | undefined>({
      fetcher: ({ page, pdfDocument }, signal) =>
        openPage(pdfDocument, page, signal),
      onLoaded: filter(
        defined,
        fork(
          renderPage
          // map(pick("textLayer"), () => {})
        )
      ),
      contentSlot,
    })
  );

  // todo move it up
  render(div(pdfSlot));

  return {
    displayContent: ({ content }) =>
      load({ pdfDocument: openPdf(content), page: 1 }),
  };
};
