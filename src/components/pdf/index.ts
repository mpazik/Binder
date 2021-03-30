import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { TextLayerBuilder } from "pdfjs-dist/lib/web/text_layer_builder.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { EventBus } from "pdfjs-dist/lib/web/ui_utils.js";
import { URL } from "schema-dts";
import "./text_layer_builder.css";

import {
  button,
  Component,
  div,
  slot,
  Slot,
  span,
  View,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { Callback, closableForEach, Consumer } from "../../libs/connections";
import { map } from "../../libs/connections/mappers";
import {
  handleState,
  mapState,
  newStateMachineWithFeedback,
  StateWithFeedback,
} from "../../libs/named-state";
import { centerLoadingSlot } from "../common/center-loading-component";

const url =
  "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf";

// The workerSrc property shall be specified.
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.js";

type PdfDocument = {
  openPage: (page: number) => void;
  numberOfPages: number;
};

const renderPdf = async (
  container: HTMLElement,
  data: Blob
): Promise<PdfDocument> => {
  const pdfDocument = await pdfjsLib.getDocument({
    data: new Uint8Array(await data.arrayBuffer()),
  }).promise;

  const div = document.createElement("div");
  div.setAttribute("style", "position: relative");
  container.appendChild(div);

  const containerWidth = container.getBoundingClientRect().width;

  const canvas = document.createElement("canvas");
  div.appendChild(canvas);

  const textLayerDiv = document.createElement("div");
  textLayerDiv.setAttribute("class", "textLayer");
  div.appendChild(textLayerDiv);

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
    div.setAttribute("id", "page-" + (page._pageIndex + 1));

    const originalViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: containerWidth / originalViewport.width,
    });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    textLayerDiv.style.width = viewport.width + "px";
    textLayerDiv.style.height = viewport.height + "px";

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

type PdfViewAction =
  | ["fetch", URL]
  | ["load", Blob]
  | ["setContainer", HTMLElement]
  | ["display", PdfDocument]
  | ["openPage", number]
  | ["fail", string];

export type PdfViewState =
  | ["idle", { container?: HTMLElement; url?: URL; data?: Blob }]
  | ["fetching", { container: HTMLElement; url: URL }]
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
          setContainer: (container, { url, data }) =>
            data
              ? ["rendering", { data, container }]
              : url
              ? ["fetching", { url, container }]
              : ["idle", { container }],
          fetch: (url, { container }) =>
            container ? ["fetching", { url, container }] : ["idle", { url }],
          load: (data, { container }) =>
            container ? ["rendering", { data, container }] : ["idle", { data }],
        },
        fetching: {
          fetch: (url, { container }) => ["fetching", { url, container }],
          load: (data, { container }) => ["rendering", { data, container }],
          fail: (reason, { container }) => ["error", { reason, container }],
        },
        rendering: {
          fetch: (url, { container }) => ["fetching", { url, container }],
          load: (data, { container }) => ["rendering", { data, container }],
          display: (document, { container }) => [
            "displaying",
            { document, container, currentPage: 1 },
          ],
          fail: (reason, { container }) => ["error", { reason, container }],
        },
        displaying: {
          fetch: (url, { container }) => ["fetching", { url, container }],
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
          fetch: (url, { container }) => ["fetching", { url, container }],
          load: (data, { container }) => ["rendering", { data, container }],
        },
      },
      closableForEach(({ state, feedback }) => {
        handleState<PdfViewState>(state, {
          fetching: ({ url }) => {
            fetch(url)
              .then((it) => it.blob())
              .then((data) => {
                feedback(["load", data]);
              });
          },
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

const contentComponent: Component<{ setContainer: Callback<HTMLElement> }> = ({
  setContainer,
}) => (render) => {
  render(div({ onDisplay: (e) => setContainer(e.target as HTMLElement) }));
};

const createPdfView: ViewSetup<{ contentSlot: Slot }, PdfStateWithFeedback> = ({
  contentSlot,
}) => ({ state, feedback }) =>
  mapState(state, {
    idle: () => {
      return div(centerLoadingSlot(), contentSlot);
    },
    fetching: () => {
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

export const pdf: Component = () => (render) => {
  const contentSlot = slot(
    "content",
    contentComponent({
      setContainer: (container) => {
        sendAction(["setContainer", container]);
      },
    })
  );
  const renderPdf = map(createPdfView({ contentSlot }), render);
  const sendAction = newPdfViewStateMachine()(renderPdf);
  sendAction(["fetch", url]);
};
