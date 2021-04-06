import * as pdfJsLib from "pdfjs-dist";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { TextLayerBuilder } from "pdfjs-dist/lib/web/text_layer_builder.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { EventBus } from "pdfjs-dist/lib/web/ui_utils.js";
import "./text_layer_builder.css";

import {
  Callback,
  closableForEach,
  Consumer,
  fork,
} from "../../libs/connections";
import { map } from "../../libs/connections/mappers";
import {
  handleState,
  mapState,
  newStateMachineWithFeedback,
  StateWithFeedback,
} from "../../libs/named-state";
import {
  button,
  canvas,
  Component,
  div,
  slot,
  Slot,
  span,
  View,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { centerLoadingSlot } from "../common/center-loading-component";

// The workerSrc property shall be specified.
pdfJsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.js";

type PdfDocument = {
  openPage: (page: number) => void;
  numberOfPages: number;
};

const renderPdf = async (
  container: HTMLElement,
  data: Blob
): Promise<PdfDocument> => {
  const pdfDocument = await pdfJsLib.getDocument({
    data: new Uint8Array(await data.arrayBuffer()),
  }).promise;

  const containerWidth = container.getBoundingClientRect().width;
  const canvas = container.getElementsByTagName("canvas")[0];
  const textLayerDiv = container.getElementsByClassName(
    "textLayer"
  )[0] as HTMLElement;

  let pageOpening = false;
  let nextPageToOpen: number | undefined;

  const openNextPage = (pageNumber: number) => {
    pageOpening = false;
    nextPageToOpen = undefined;
    openPage(pageNumber);
  };

  const openPage = async (pageNumber: number) => {
    if (pageOpening) {
      nextPageToOpen = pageNumber;
      return;
    }
    pageOpening = true;

    const page = await pdfDocument.getPage(pageNumber);
    if (nextPageToOpen) {
      openNextPage(nextPageToOpen);
      return;
    }
    container.setAttribute("id", "page-" + (page._pageIndex + 1));

    const originalViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: containerWidth / originalViewport.width,
    });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    textLayerDiv.style.width = viewport.width + "px";
    textLayerDiv.style.height = viewport.height + "px";
    textLayerDiv.innerHTML = "";

    await page.render({
      canvasContext: canvas.getContext("2d")!,
      viewport: viewport,
    });
    if (nextPageToOpen) {
      openNextPage(nextPageToOpen);
      return;
    }

    const eventBus = new EventBus();
    const textContent = await page.getTextContent();
    const textLayer = new TextLayerBuilder({
      textLayerDiv: textLayerDiv,
      pageIndex: page._pageIndex,
      viewport: viewport,
      eventBus,
    });

    textLayer.setTextContent(textContent);
    textLayer.render();
    nextPageToOpen = undefined;
    pageOpening = false;
  };

  return {
    openPage,
    numberOfPages: pdfDocument.numPages,
  };
};

const contentComponent: Component<{ onDisplay: Callback<HTMLElement> }> = ({
  onDisplay,
}) => (render) => {
  render(
    div(
      {
        onDisplay: (e) => onDisplay(e.target as HTMLElement),
        style: { position: "relative" },
      },
      canvas(),
      div({ class: "textLayer" })
    )
  );
};

type PdfViewAction =
  | ["load", Blob]
  | ["setContainer", HTMLElement]
  | ["display", PdfDocument]
  | ["openPage", number]
  | ["fail", string];

export type PdfViewState =
  | ["idle", { container?: HTMLElement; data?: Blob }]
  | ["rendering", { data: Blob; container: HTMLElement }]
  | [
      "displaying",
      { document: PdfDocument; currentPage: number; container: HTMLElement }
    ]
  | ["error", { reason: string; container: HTMLElement }];

type PdfStateWithFeedback = StateWithFeedback<PdfViewState, PdfViewAction>;

const newPdfViewStateMachine = () => {
  return (push: Consumer<PdfStateWithFeedback>) =>
    newStateMachineWithFeedback<PdfViewState, PdfViewAction>(
      ["idle", {}],
      {
        idle: {
          setContainer: (container, { data }) =>
            data ? ["rendering", { data, container }] : ["idle", { container }],
          load: (data, { container }) =>
            container ? ["rendering", { data, container }] : ["idle", { data }],
        },
        rendering: {
          load: (data, { container }) => ["rendering", { data, container }],
          display: (document, { container }) => [
            "displaying",
            { document, container, currentPage: 1 },
          ],
          fail: (reason, { container }) => ["error", { reason, container }],
        },
        displaying: {
          openPage: (pageNumber, { document, container }) => [
            "displaying",
            { document, container, currentPage: pageNumber },
          ],
          load: (data, { container }) => ["rendering", { data, container }],
        },
        error: {
          setContainer: (container, { reason }) => [
            "error",
            { reason, container },
          ],
          load: (data, { container }) => ["rendering", { data, container }],
        },
      },
      closableForEach(({ state, feedback }) => {
        handleState<PdfViewState>(state, {
          rendering: ({ container, data }) => {
            renderPdf(container, data).then((it) => {
              feedback(["display", it]);
            });
          },
          displaying: ({ document, currentPage }) => {
            document.openPage(currentPage);
          },
        });
      }, push)
    );
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

const createPdfView: ViewSetup<{ contentSlot: Slot }, PdfStateWithFeedback> = ({
  contentSlot,
}) => ({ state, feedback }) =>
  mapState(state, {
    idle: () => {
      return div(centerLoadingSlot(), contentSlot);
    },
    rendering: () => {
      return div(centerLoadingSlot(), contentSlot);
    },
    displaying: ({ document: { numberOfPages }, currentPage }) => {
      return div(
        pdfNav({
          currentPage,
          numberOfPages,
          openPage: (number) => feedback(["openPage", number]),
        }),
        contentSlot,
        pdfNav({
          currentPage,
          numberOfPages,
          openPage: (number) => feedback(["openPage", number]),
        })
      );
    },
    error: ({ reason }) => {
      return div({ class: "flash mt-3 flash-error" }, span(reason));
    },
  });

export const pdfContentDisplay: Component<
  { onDisplay: () => void },
  { updateContent: Blob }
> = ({ onDisplay }) => (render) => {
  const contentSlot = slot(
    "content",
    contentComponent({
      onDisplay: fork(onDisplay, (container) => {
        sendAction(["setContainer", container]);
      }),
    })
  );
  const renderPdf = map(createPdfView({ contentSlot }), render);
  const sendAction = newPdfViewStateMachine()(renderPdf);

  return {
    updateContent: (blob) => sendAction(["load", blob]),
  };
};
