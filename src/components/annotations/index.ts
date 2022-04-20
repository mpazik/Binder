import "./style.css";

import type { Callback } from "linki";
import {
  cast,
  defined,
  filter,
  fork,
  ignoreParam,
  link,
  map,
  nextTick,
  passOnlyChanged,
  pick,
  to,
} from "linki";
import type { UiComponent } from "linki-ui";
import { mountComponent } from "linki-ui";

import type { Uri } from "../../libs/browser-providers";
import { throwIfNull } from "../../libs/errors";
import {
  closableProcessorFromProvider,
  withMultiState,
} from "../../libs/linki";
import { handleAction } from "../../libs/named-state";
import { createDelete } from "../../vocabulary/activity-streams";
import type { PageControls } from "../system/page";

import type {
  Annotation,
  AnnotationSelector,
  DocFragment,
  QuoteSelector,
} from "./annotation";
import { isQuoteSelector } from "./annotation";
import { annotationDisplay, commentForm } from "./annotation-display";
import { containerText, removeSelector, renderSelector } from "./highlights";
import { quoteSelectorForRange } from "./quote-selector";
import type { Selection } from "./selection";
import { currentSelection, selectionPosition } from "./selection";
import { selectionToolbar } from "./selection-toolbar";
import { createAnnotationSaver } from "./service";

export type AnnotationDisplayRequest = {
  textLayer: HTMLElement;
  fragment?: DocFragment;
};

export const getQuoteSelector = (
  selector: AnnotationSelector
): QuoteSelector => {
  if (isQuoteSelector(selector)) {
    return selector;
  }
  const child = throwIfNull(selector.refinedBy);
  if (isQuoteSelector(child)) {
    return child;
  }
  throw new Error(
    `Expected quote selector but got: ${JSON.stringify(selector)}`
  );
};

type AnnotationAction =
  | ["display", Annotation]
  | ["select", Selection]
  | ["remove", QuoteSelector];
export const annotationsSupport = (
  {
    readLinkedData,
    saveLinkedData,
    subscribe: { annotations: subscribeAnnotations },
    readAppContext,
  }: PageControls,
  reference: Uri
): UiComponent<{
  displayDocumentAnnotations: AnnotationDisplayRequest;
  setContainer: HTMLElement;
}> => ({ render }) => {
  const [
    changeSelection,
    setContainerForSelector,
    setTextLayerForSelector,
  ] = link(
    withMultiState<[HTMLElement, HTMLElement | undefined], AnnotationAction>(
      undefined,
      undefined
    ),
    ([container, textLayer, change]) => {
      if (!container || !textLayer) {
        return;
      }
      const text = containerText(textLayer);
      handleAction(change, {
        display: (annotation) => {
          if (!annotation.target.selector) {
            return;
          }
          const selector = getQuoteSelector(annotation.target.selector);
          renderSelector(
            container,
            textLayer,
            text,
            selector,
            annotation.motivation === "commenting" ? "yellow" : "green",
            link(
              map((position) => ({
                annotation,
                position,
              })),
              displayAnnotation
            ),
            hideAnnotationDelayed
          );
        },
        select: (selection) => {
          const position = selectionPosition(selection);
          const { fragment, range } = selection;
          const selector = quoteSelectorForRange(
            textLayer,
            text,
            range,
            fragment
          );
          renderSelector(
            container,
            textLayer,
            text,
            getQuoteSelector(selector),
            "purple"
          );
          displayCommentForm([
            "visible",
            {
              selector,
              position,
            },
          ]);
        },
        remove: (selector) => {
          removeSelector(textLayer, text, selector);
        },
      });
    }
  );

  const saveAnnotation = createAnnotationSaver(readAppContext, saveLinkedData);

  const [selectionToolbarSlot, { selectionHandler }] = mountComponent(
    selectionToolbar({
      buttons: [
        {
          handler: (it) => changeSelection(["select", it]),
          label: "comment",
          shortCutKey: "c",
        },
        {
          handler: ({ container, range, fragment }) => {
            const text = containerText(container);
            const selector = quoteSelectorForRange(
              container,
              text,
              range,
              fragment
            );
            saveAnnotation({ selector, reference });
          },
          label: "highlight",
          shortCutKey: "h",
        },
      ],
    })
  );

  const [handleSelection, setFragmentForToolbar, setContainerForToolbar] = link(
    withMultiState<[DocFragment | undefined, HTMLElement], void>(
      undefined,
      undefined
    ),
    map(([fragment, container]) => {
      if (!container) return;
      const range = currentSelection();
      if (!range) return;
      if (!container.contains(range.commonAncestorContainer)) return;
      return { range, fragment, container };
    }),
    passOnlyChanged(),
    selectionHandler
  );

  const [
    annotationDisplaySlot,
    { displayAnnotation, hideAnnotationDelayed, hideAnnotation },
  ] = mountComponent(annotationDisplay, {
    deleteAnnotation: link(map(createDelete), saveLinkedData),
  });

  const [commentFormSlot, { displayCommentForm }] = mountComponent(
    commentForm,
    {
      onHide: ({ selector }) =>
        changeSelection(["remove", getQuoteSelector(selector)]),
      onCreatedComment: ({ selector, comment }) => {
        saveAnnotation({ selector, content: comment, reference });
      },
    }
  );

  const [subscribeForAnnotations, closeSubscription] = link(
    closableProcessorFromProvider(subscribeAnnotations),
    (change) => {
      handleAction(change, {
        to: (value) => {
          value.forEach((it) => changeSelection(["display", it]));
        },
        set: (value) => {
          changeSelection(["display", value]);
        },
        del: (id) => {
          readLinkedData(id).then(
            link(filter(defined), map(cast()), (annotation: Annotation) => {
              if (!annotation.target.selector) {
                return;
              }
              const selector = getQuoteSelector(annotation.target.selector);
              changeSelection(["remove", selector]);
            })
          );
        },
      });
    }
  );

  const displayDocumentAnnotations: Callback<AnnotationDisplayRequest> = link(
    map(({ fragment }) => ({
      fragment: fragment?.value,
      reference,
    })),
    subscribeForAnnotations
  );

  // next tick to make sure current selection would be calculated for even handling
  const detectSelection = link(ignoreParam(), nextTick(), handleSelection);
  document.addEventListener("mouseup", detectSelection);

  render([commentFormSlot, annotationDisplaySlot, selectionToolbarSlot]);
  return {
    stop: fork(() => {
      document.removeEventListener("mouseup", detectSelection);
    }, closeSubscription),
    setContainer: fork(
      setContainerForSelector,
      setContainerForToolbar,
      link(map(to(undefined)), setTextLayerForSelector)
    ),
    displayDocumentAnnotations: fork(
      link(map(pick("fragment")), setFragmentForToolbar),
      link(map(pick("textLayer")), setTextLayerForSelector),
      displayDocumentAnnotations,
      link(ignoreParam(), handleSelection),
      () => displayCommentForm(["hidden"]),
      () => hideAnnotation()
    ),
  };
};
