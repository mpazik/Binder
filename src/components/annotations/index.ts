import { DocumentAnnotationsIndex } from "../../functions/indexes/document-annotations-index";
import { LinkedDataStoreWrite } from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { fork, withMultiState, withState } from "../../libs/connections";
import { filter, nonNull } from "../../libs/connections/filters";
import { ignoreParam, map, withValue } from "../../libs/connections/mappers";
import { throwIfNull } from "../../libs/errors";
import { HashUri } from "../../libs/hash";
import { Component, div, newSlot } from "../../libs/simple-ui/render";

import {
  Annotation,
  AnnotationSelector,
  createAnnotation,
  DocFragment,
  isQuoteSelector,
  QuoteSelector,
} from "./annotation";
import {
  annotationDisplay,
  AnnotationDisplayState,
  commentForm,
} from "./annotation-display";
import { containerText, removeSelector, renderSelector } from "./highlights";
import { quoteSelectorForRange } from "./quote-selector";
import { OptSelection, selectionPosition } from "./selection";
import { selectionToolbar } from "./selection-toolbar";

type AnnotationSaveArgs = {
  container: HTMLElement;
  selector: AnnotationSelector;
  content?: string;
};

export type AnnotationDisplayRequest = {
  container: HTMLElement;
  reference: HashUri;
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
    ldStoreWrite: LinkedDataStoreWrite;
    ldStoreRead: LinkedDataStoreRead;
    documentAnnotationsIndex: DocumentAnnotationsIndex;
    requestDocumentSave: () => void;
  },
  {
    displayDocumentAnnotations: AnnotationDisplayRequest;
    displaySelectionToolbar: OptSelection;
    setCreator: string;
    setReference: HashUri | undefined;
  }
> = ({
  ldStoreWrite,
  ldStoreRead,
  requestDocumentSave,
  documentAnnotationsIndex,
}) => (render) => {
  const [saveAnnotation, [setCreator, setReference]] = withMultiState<
    [string, HashUri | undefined],
    AnnotationSaveArgs
  >(
    ([creator, reference], annotationSaveArgs) => {
      if (!reference) {
        keepAnnotationForSave(annotationSaveArgs);
        requestDocumentSave();
        return;
      }
      const { container, selector, content } = annotationSaveArgs;
      const annotation = createAnnotation(
        reference,
        selector,
        content,
        creator ?? undefined
      );
      ldStoreWrite(annotation).then(() => {
        displayAnnotationSelection(
          container,
          containerText(container),
          annotation
        );
      });
    },
    undefined,
    undefined
  );

  const [
    saveKeptAnnotation,
    keepAnnotationForSave,
  ] = withState<AnnotationSaveArgs | null>(
    filter(nonNull, (annotationToSave) => {
      saveAnnotation(annotationToSave);
      keepAnnotationForSave(null);
    }),
    null
  );

  const displayAnnotationSelection = (
    container: HTMLElement,
    text: string,
    annotation: Annotation
  ) =>
    renderSelector(
      container,
      text,
      getQuoteSelector(annotation.target.selector),
      annotation.motivation === "commenting" ? "yellow" : "green",
      map(
        (position) =>
          ["visible", { annotation, position }] as AnnotationDisplayState,
        displayAnnotation
      ),
      withValue(["hidden"], displayAnnotation)
    );

  const [selectionToolbarSlot, { selectionHandler }] = newSlot(
    "selection-toolbar",
    selectionToolbar({
      buttons: [
        {
          handler: (selection) => {
            const { range, container } = selection;
            const text = containerText(container);
            const selector = quoteSelectorForRange(container, text, range);
            renderSelector(
              container,
              text,
              getQuoteSelector(selector),
              "purple"
            );
            displayCommentForm([
              "visible",
              {
                container,
                selector: getQuoteSelector(selector),
                position: selectionPosition(selection),
              },
            ]);
          },
          label: "comment",
          shortCutKey: "KeyC",
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
            saveAnnotation({ container, selector });
          },
          label: "highlight",
          shortCutKey: "KeyH",
        },
      ],
    })
  );
  const [annotationDisplaySlot, { displayAnnotation }] = newSlot(
    "annotation-display",
    annotationDisplay()
  );

  const [commentFormSlot, { displayCommentForm }] = newSlot(
    "comment-form",
    commentForm({
      onHide: ({ container, selector }) => {
        return removeSelector(container, containerText(container), selector);
      },
      onCreatedComment: ({ container, selector, comment }) => {
        const text = containerText(container);
        removeSelector(container, text, selector);
        saveAnnotation({ container, selector, content: comment });
      },
    })
  );

  render(div(commentFormSlot, annotationDisplaySlot, selectionToolbarSlot));
  return {
    setReference: fork(setReference, ignoreParam(saveKeptAnnotation)),
    displaySelectionToolbar: selectionHandler,
    setCreator: setCreator,
    displayDocumentAnnotations: async ({ container, reference, fragment }) => {
      const text = containerText(container);
      const annotationsHashUris = await documentAnnotationsIndex({
        documentHashUri: reference,
        fragment: fragment?.value,
      });
      console.log("annotations", annotationsHashUris);
      annotationsHashUris.forEach((hashUri) => {
        ldStoreRead(hashUri).then(
          filter(nonNull, (annotation) => {
            displayAnnotationSelection(
              container,
              text,
              (annotation as unknown) as Annotation
            );
          })
        );
      });
    },
  };
};
