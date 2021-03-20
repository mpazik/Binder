import { DocumentAnnotationsIndex } from "../../functions/indexes/document-annotations-index";
import { LinkedDataStoreWrite } from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { dataPortal, fork, Provider } from "../../libs/connections";
import {
  combine,
  filterNonNull,
  map,
  ignoreParam,
  withValue,
  withState,
} from "../../libs/connections/processors2";
import { HashUri } from "../../libs/hash";
import { findHashUri, LinkedData } from "../../libs/linked-data";
import { Component, div, slot } from "../../libs/simple-ui/render";

import { Annotation, createAnnotation, QuoteSelector } from "./annotation";
import {
  commentDisplay,
  CommentDisplayState,
  commentForm,
  CommentFormState,
} from "./comment";
import { containerText, removeSelector, renderSelector } from "./highlights";
import { quoteSelectorForRange } from "./quote-selector";
import { OptSelection } from "./selection";
import { selectionToolbar } from "./selection-toolbar";

type AnnotationSaveArgs = {
  container: HTMLElement;
  selector: QuoteSelector;
  content?: string;
};
export const annotationsSupport: Component<{
  ldStoreWrite: LinkedDataStoreWrite;
  ldStoreRead: LinkedDataStoreRead;
  creatorProvider: Provider<string>;
  selectionProvider: Provider<OptSelection>;
  documentAnnotationsIndex: DocumentAnnotationsIndex;
  referenceProvider: Provider<HashUri>;
  requestDocumentSave: () => void;
  documentProvider: Provider<{
    container: HTMLElement;
    linkedData: LinkedData;
  }>;
}> = ({
  ldStoreWrite,
  ldStoreRead,
  creatorProvider,
  referenceProvider,
  requestDocumentSave,
  selectionProvider,
  documentAnnotationsIndex,
  documentProvider,
}) => (render, onClose) => {
  const [commentToDisplayProvider, displayComment] = dataPortal<
    CommentDisplayState
  >();
  const [commentFormProvider, displayCommentForm] = dataPortal<
    CommentFormState
  >();

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

  creatorProvider(onClose, setCreator);
  referenceProvider(
    onClose,
    fork(setReference, ignoreParam(saveKeptAnnotation))
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

  documentProvider(onClose, async ({ container, linkedData }) => {
    const text = containerText(container);
    const documentHashUri = findHashUri(linkedData);
    if (!documentHashUri) return;
    const annotationsHashUris = await documentAnnotationsIndex({
      documentHashUri,
    });
    annotationsHashUris.forEach((hashUri) => {
      ldStoreRead(hashUri).then(
        filterNonNull((annotation) => {
          displayAnnotation(
            container,
            text,
            (annotation as unknown) as Annotation
          );
        })
      );
    });
  });

  render(
    div(
      slot(
        "comment-form",
        commentForm({
          commentFormProvider,
          onHide: ({ selection: { container, range } }) => {
            const text = containerText(container);
            return removeSelector(
              container,
              text,
              quoteSelectorForRange(container, text, range)
            );
          },
          onCreatedComment: ({ selection: { container, range }, comment }) => {
            const text = containerText(container);
            const selector = quoteSelectorForRange(container, text, range);
            removeSelector(container, text, selector);
            saveAnnotation({ container, selector, content: comment });
          },
        })
      ),
      slot(
        "comment-display",
        commentDisplay({
          commentProvider: commentToDisplayProvider,
        })
      ),
      slot(
        "selection-toolbar",
        selectionToolbar({
          selectionProvider,
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
                    selection,
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
              shortCutKey: "KeyG",
            },
          ],
        })
      )
    )
  );
};
