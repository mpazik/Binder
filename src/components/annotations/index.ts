import { DocumentAnnotationsIndex } from "../../functions/indexes/document-annotations-index";
import { LinkedDataStoreWrite } from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { combine, fork, withState } from "../../libs/connections";
import { filterNonNull } from "../../libs/connections/filters";
import { ignoreParam, map, withValue } from "../../libs/connections/mappers";
import { HashUri } from "../../libs/hash";
import { findHashUri, LinkedData } from "../../libs/linked-data";
import { Component, div, newSlot } from "../../libs/simple-ui/render";

import { Annotation, createAnnotation, QuoteSelector } from "./annotation";
import { commentDisplay, CommentDisplayState, commentForm } from "./comment";
import { containerText, removeSelector, renderSelector } from "./highlights";
import { quoteSelectorForRange } from "./quote-selector";
import { OptSelection, selectionPosition } from "./selection";
import { selectionToolbar } from "./selection-toolbar";

type AnnotationSaveArgs = {
  container: HTMLElement;
  selector: QuoteSelector;
  content?: string;
};
export const annotationsSupport: Component<
  {
    ldStoreWrite: LinkedDataStoreWrite;
    ldStoreRead: LinkedDataStoreRead;
    documentAnnotationsIndex: DocumentAnnotationsIndex;
    requestDocumentSave: () => void;
  },
  {
    displayDocumentAnnotations: {
      container: HTMLElement;
      linkedData: LinkedData;
    };
    displaySelectionToolbar: OptSelection;
    setCreator: string;
    setReference: HashUri;
  }
> = ({
  ldStoreWrite,
  ldStoreRead,
  requestDocumentSave,
  documentAnnotationsIndex,
}) => (render) => {
  const [setCreator, setReference, saveAnnotation] = combine<
    [string | null, HashUri, AnnotationSaveArgs]
  >(
    ([creator, reference, annotationSaveArgs]) => {
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
        displayAnnotation(container, containerText(container), annotation);
      });
    },
    null,
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

  const displayAnnotation = (
    container: HTMLElement,
    text: string,
    annotation: Annotation
  ) =>
    renderSelector(
      container,
      text,
      annotation.target.selector,
      annotation.motivation === "commenting" ? "yellow" : "green",
      annotation.body
        ? map(
            (position) =>
              [
                "visible",
                { content: annotation.body?.value, position },
              ] as CommentDisplayState,
            displayComment
          )
        : undefined,
      annotation.body ? withValue(["hidden"], displayComment) : undefined
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
            console.log("selector", selector, range);
            saveAnnotation({ container, selector });
          },
          label: "highlight",
          shortCutKey: "KeyG",
        },
      ],
    })
  );
  const [commentDisplaySlot, { displayComment }] = newSlot(
    "comment-display",
    commentDisplay()
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

  render(div(commentFormSlot, commentDisplaySlot, selectionToolbarSlot));
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
            console.log("display annotation", annotation);
            displayAnnotation(
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
