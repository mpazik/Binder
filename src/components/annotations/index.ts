import { DocumentAnnotationsIndex } from "../../functions/indexes/document-annotations-index";
import { LinkedDataStoreWrite } from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { fork, withMultiState, withState } from "../../libs/connections";
import { filterNonNull } from "../../libs/connections/filters";
import { ignoreParam, map, withValue } from "../../libs/connections/mappers";
import { HashUri } from "../../libs/hash";
import { findHashUri, LinkedData } from "../../libs/linked-data";
import { Component, div, newSlot } from "../../libs/simple-ui/render";

import { Annotation, createAnnotation, QuoteSelector } from "./annotation";
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
  selector: QuoteSelector;
  content?: string;
};

export type AnnotationDisplayRequest = {
  container: HTMLElement;
  linkedData: LinkedData;
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
    filterNonNull((annotationToSave) => {
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
      annotation.target.selector,
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
            renderSelector(container, text, selector, "purple");
            displayCommentForm([
              "visible",
              {
                container,
                selector,
                position: selectionPosition(selection),
              },
            ]);
          },
          label: "comment",
          shortCutKey: "KeyC",
        },
        {
          handler: ({ container, range }) => {
            const text = containerText(container);
            const selector = quoteSelectorForRange(container, text, range);
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
    displayDocumentAnnotations: async ({ container, linkedData }) => {
      const text = containerText(container);
      const documentHashUri = findHashUri(linkedData);
      if (!documentHashUri) return;
      const annotationsHashUris = await documentAnnotationsIndex({
        documentHashUri,
      });
      annotationsHashUris.forEach((hashUri) => {
        ldStoreRead(hashUri).then(
          filterNonNull((annotation) => {
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
