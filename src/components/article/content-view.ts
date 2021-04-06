import { URL } from "schema-dts";

import {
  LinkedDataWithContent,
  SavedLinkedDataWithContent,
} from "../../functions/content-processors";
import { DocumentAnnotationsIndex } from "../../functions/indexes/document-annotations-index";
import {
  LinkedDataStoreWrite,
  ResourceStoreWrite,
} from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { Consumer, fork, withState } from "../../libs/connections";
import { map, pick, pipe } from "../../libs/connections/mappers";
import { throwIfNull2 } from "../../libs/errors";
import {
  findHashUri,
  findUrl,
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/linked-data";
import {
  a,
  Component,
  div,
  newSlot,
  span,
  View,
} from "../../libs/simple-ui/render";
import { annotationsSupport } from "../annotations";

import { contentDisplayComponent } from "./content-display";

const contentHeaderView: View<LinkedData> = (linkedData: LinkedData) => {
  const uri = findUrl(linkedData);
  return div(
    { class: "Subhead" },
    div({ class: "Subhead-heading" }, String(linkedData.name)),
    div(
      { class: "Subhead-description" },
      ...(uri
        ? [
            span(
              "From: ",
              a({ href: uri, target: "_blank" }, new URL(uri).hostname)
            ),
          ]
        : [])
    )
  );
};

const contentFields: Component<void, { renderFields: LinkedData }> = () => (
  render
) => ({
  renderFields: (linkedData) => render(contentHeaderView(linkedData)),
});

export const editableContentComponent: Component<
  {
    storeWrite: ResourceStoreWrite;
    ldStoreWrite: LinkedDataStoreWrite;
    ldStoreRead: LinkedDataStoreRead;
    onSave: Consumer<LinkedDataWithHashId>;
    documentAnnotationsIndex: DocumentAnnotationsIndex;
  },
  { setCreator: string; setContent: LinkedDataWithContent }
> = ({
  storeWrite,
  ldStoreWrite,
  ldStoreRead,
  onSave,
  documentAnnotationsIndex,
}) => (render) => {
  const [handleContentDisplayed, setContent] = withState<
    LinkedDataWithContent,
    HTMLElement
  >(({ linkedData }, container) => {
    displayDocumentAnnotations({ container, linkedData });
  });

  const [
    annotationSupportSlot,
    {
      displaySelectionToolbar,
      displayDocumentAnnotations,
      setCreator,
      setReference,
    },
  ] = newSlot(
    "annotation-support",
    annotationsSupport({
      ldStoreWrite,
      ldStoreRead,
      documentAnnotationsIndex,
      requestDocumentSave: () => saveContent(),
    })
  );

  const [contentSlot, { displayContent, saveContent }] = newSlot(
    "content",
    contentDisplayComponent({
      ldStoreWrite,
      storeWrite,
      onDisplay: handleContentDisplayed,
      onSelect: displaySelectionToolbar,
      onSave: fork<SavedLinkedDataWithContent>(
        setContent,
        map(
          pick("linkedData"),
          fork(
            onSave,
            map(
              pipe(
                findHashUri,
                throwIfNull2(
                  () =>
                    "save article should have hash uri reference to the content"
                )
              ),
              setReference
            )
          )
        )
      ),
    })
  );

  const [contentFieldsSlot, { renderFields }] = newSlot(
    "content-fields",
    contentFields()
  );

  render(
    div(
      { id: "content", class: "ml-4" },
      contentFieldsSlot,
      div(
        { id: "editor", class: "mb-3 position-relative" },
        contentSlot,
        annotationSupportSlot
      )
    )
  );

  return {
    setCreator,
    setContent: fork(
      setContent,
      displayContent,
      map(
        pick("linkedData"),
        fork(renderFields, map(findHashUri, setReference))
      )
    ),
  };
};
