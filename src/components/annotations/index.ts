import "./style.css";

import {
  link,
  filter,
  map,
  ignoreParam,
  fork,
  pick,
  to,
  passOnlyChanged,
  withState,
  valueWithState,
  definedTuple,
  nextTick,
  defined,
  splitDefinedProp,
} from "linki";

import { throwIfNull } from "../../libs/errors";
import type { HashUri } from "../../libs/hash";
import { withMultiState } from "../../libs/linki";
import { handleState } from "../../libs/named-state";
import type { Component } from "../../libs/simple-ui/render";
import { div, newSlot } from "../../libs/simple-ui/render";

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
import type { AnnotationSaveProps } from "./service";
import type { AnnotationsFeeder } from "./service";
import type { AnnotationsSaver } from "./service";

type AnnotationSavePropsWihoutRef = Omit<AnnotationSaveProps, "reference">;

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

export const annotationsSupport: Component<
  {
    requestDocumentSave: () => void;
    saveAnnotation: AnnotationsSaver;
    annotationFeeder: AnnotationsFeeder;
  },
  {
    displayDocumentAnnotations: AnnotationDisplayRequest;
    setContainer: HTMLElement;
    setReference: HashUri | undefined;
  }
> = ({ annotationFeeder, requestDocumentSave, saveAnnotation }) => (
  render,
  onClose
) => {
  const [saveAnnotationInt, setReference] = link(
    valueWithState<HashUri | undefined, AnnotationSavePropsWihoutRef>(
      undefined
    ),
    map(
      ([reference, { selector, content }]) =>
        ({
          reference,
          selector,
          content,
        } as AnnotationSaveProps)
    ),
    splitDefinedProp("reference"),
    [
      saveAnnotation,
      fork<AnnotationSavePropsWihoutRef>(
        (it) => keepAnnotationForSave(it),
        requestDocumentSave
      ),
    ]
  );

  const [saveKeptAnnotation, keepAnnotationForSave] = link(
    withState<AnnotationSavePropsWihoutRef | undefined>(undefined),
    filter(defined),
    fork(saveAnnotationInt, (): void => keepAnnotationForSave(undefined))
  );

  const [
    changeSelection,
    setContainerForSelector,
    setTextLayerForSelector,
  ] = link(
    withMultiState<
      [HTMLElement, HTMLElement | undefined],
      | ["display", Annotation]
      | ["select", Selection]
      | ["remove", QuoteSelector]
    >(undefined, undefined),
    ([container, textLayer, change]) => {
      if (!container || !textLayer) {
        return;
      }
      const text = containerText(textLayer);
      handleState(change, {
        display: (annotation) => {
          if (!annotation.target.selector) {
            return;
          }
          renderSelector(
            container,
            textLayer,
            text,
            getQuoteSelector(annotation.target.selector),
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

  const [selectionToolbarSlot, { selectionHandler }] = newSlot(
    "selection-toolbar",
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
            saveAnnotationInt({ selector });
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
  ] = newSlot("annotation-display", annotationDisplay());

  const [commentFormSlot, { displayCommentForm }] = newSlot(
    "comment-form",
    commentForm({
      onHide: ({ selector }) =>
        changeSelection(["remove", getQuoteSelector(selector)]),
      onCreatedComment: ({ selector, comment }) => {
        saveAnnotationInt({ selector, content: comment });
      },
    })
  );

  const subscribeForAnnotations = link(
    annotationFeeder,
    map((annotation): ["display", Annotation] => ["display", annotation]),
    changeSelection
  );
  const [displayDocumentAnnotations, setReferenceForAnnotationDisplay] = link(
    valueWithState<HashUri | undefined, AnnotationDisplayRequest>(undefined),
    filter(definedTuple),
    map(([reference, { fragment }]) => ({
      fragment: fragment?.value,
      hash: reference,
    })),
    subscribeForAnnotations
  );

  // next tick to make sure current selection would be calculated for even handling
  const detectSelection = link(ignoreParam(), nextTick(), handleSelection);
  document.addEventListener("mouseup", detectSelection);
  onClose(() => {
    document.removeEventListener("mouseup", detectSelection);
  });

  render(div(commentFormSlot, annotationDisplaySlot, selectionToolbarSlot));
  return {
    setReference: fork(
      setReference,
      setReferenceForAnnotationDisplay,
      link(ignoreParam(), saveKeptAnnotation)
    ),
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
