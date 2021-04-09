import * as pdfJsLib from "pdfjs-dist";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { TextLayerBuilder } from "pdfjs-dist/lib/web/text_layer_builder.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { EventBus } from "pdfjs-dist/lib/web/ui_utils.js";
import "./text_layer_builder.css";

import { LinkedDataWithContent } from "../../../functions/content-processors";
import { Callback, closableForEach, Consumer } from "../../../libs/connections";
import { map } from "../../../libs/connections/mappers";
import { LinkedData } from "../../../libs/linked-data";
import {
  handleState,
  mapState,
  newStateMachineWithFeedback,
  StateWithFeedback,
} from "../../../libs/named-state";
import { measureAsyncTime } from "../../../libs/performance";
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
} from "../../../libs/simple-ui/render";
import { getTarget } from "../../../libs/simple-ui/utils/funtions";
import { AnnotationDisplayRequest } from "../../annotations";
import { centerLoadingSlot } from "../../common/center-loading-component";

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

const contentComponent: Component<{
  onDisplay: Callback<HTMLElement>;
  onTextDisplay: (container: HTMLElement) => void;
  onSelectionTrigger: () => void;
}> = ({ onDisplay, onTextDisplay, onSelectionTrigger }) => (render) => {
  render(
    div(
      {
        onDisplay: map(getTarget, onDisplay),
        style: { position: "relative" },
      },
      canvas(),
      div({
        class: "textLayer",
        onDisplay: map(getTarget, onTextDisplay),
        onMouseup: onSelectionTrigger,
        onFocusout: onSelectionTrigger,
      })
    )
  );
};

type PdfViewAction =
  | ["load", LinkedDataWithContent]
  | ["setContainer", HTMLElement]
  | ["setTextContainer", HTMLElement]
  | ["display", PdfDocument]
  | ["openPage", number]
  | ["fail", string];

export type PdfViewState =
  | [
      "idle",
      {
        container?: HTMLElement;
        textContainer?: HTMLElement;
        data?: LinkedDataWithContent;
      }
    ]
  | [
      "rendering",
      {
        data: LinkedDataWithContent;
        container: HTMLElement;
        textContainer: HTMLElement;
      }
    ]
  | [
      "displaying",
      {
        document: PdfDocument;
        currentPage: number;
        container: HTMLElement;
        linkedData: LinkedData;
        textContainer: HTMLElement;
      }
    ]
  | [
      "error",
      { reason: string; container: HTMLElement; textContainer: HTMLElement }
    ];

type PdfStateWithFeedback = StateWithFeedback<PdfViewState, PdfViewAction>;

const newPdfViewStateMachine = (
  displayAnnotations: Consumer<AnnotationDisplayRequest>
) => {
  return (push: Consumer<PdfStateWithFeedback>) =>
    newStateMachineWithFeedback<PdfViewState, PdfViewAction>(
      ["idle", {}],
      {
        idle: {
          setContainer: (container, { data, textContainer }) =>
            data && textContainer
              ? ["rendering", { data, container, textContainer }]
              : ["idle", { data, container, textContainer }],
          setTextContainer: (textContainer, { data, container }) =>
            data && container
              ? ["rendering", { data, container, textContainer }]
              : ["idle", { data, container, textContainer }],
          load: (data, { container, textContainer }) =>
            container && textContainer
              ? ["rendering", { data, container, textContainer }]
              : ["idle", { data, container, textContainer }],
        },
        rendering: {
          load: (data, state) => ["rendering", { ...state, data }],
          display: (
            document,
            { container, textContainer, data: { linkedData } }
          ) => [
            "displaying",
            { document, container, textContainer, currentPage: 1, linkedData },
          ],
          fail: (reason, state) => ["error", { reason, ...state }],
        },
        displaying: {
          openPage: (pageNumber, state) => [
            "displaying",
            { ...state, currentPage: pageNumber },
          ],
          load: (data, state) => ["rendering", { data, ...state }],
        },
        error: {
          load: (data, state) => ["rendering", { data, ...state }],
        },
      },
      closableForEach(({ state, feedback }) => {
        handleState<PdfViewState>(state, {
          rendering: ({ container, data: { content } }) => {
            measureAsyncTime("pdf-render", () =>
              renderPdf(container, content)
            ).then((it) => {
              feedback(["display", it]);
            });
          },
          displaying: ({ document, currentPage, linkedData, container }) => {
            document.openPage(currentPage);
            displayAnnotations({ container, linkedData });
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

export const pdfDisplay: Component<
  {
    onAnnotationDisplayRequest: Consumer<AnnotationDisplayRequest>;
    onSelectionTrigger: () => void;
  },
  { displayContent: LinkedDataWithContent }
> = ({ onAnnotationDisplayRequest, onSelectionTrigger }) => (render) => {
  const contentSlot = slot(
    "content",
    contentComponent({
      onDisplay: (container) => {
        sendAction(["setContainer", container]);
      },
      onSelectionTrigger,
      onTextDisplay: (container) => sendAction(["setTextContainer", container]),
    })
  );
  const renderPdf = map(createPdfView({ contentSlot }), render);
  const sendAction = newPdfViewStateMachine(onAnnotationDisplayRequest)(
    renderPdf
  );

  return {
    displayContent: (content) => sendAction(["load", content]),
  };
};
