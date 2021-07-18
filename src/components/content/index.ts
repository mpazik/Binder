import { link, map, pick } from "linki";

import { LinkedDataWithContent } from "../../functions/content-processors";
import { ContentSaver } from "../../functions/content-saver";
import { AnnotationsIndex } from "../../functions/indexes/annotations-index";
import { LinkedDataStoreWrite } from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { Consumer, fork, splitMap, withState } from "../../libs/connections";
import { throwIfNull2 } from "../../libs/errors";
import { LinkedData, LinkedDataWithHashId } from "../../libs/jsonld-format";
import { findHashUri } from "../../libs/linked-data";
import { Component, div, newSlot } from "../../libs/simple-ui/render";
import { getTarget } from "../../libs/simple-ui/utils/funtions";
import { annotationsSupport } from "../annotations";
import {
  contentDisplayComponent,
  LinkedDataWithContentAndFragment,
} from "../content-body";

import { contentHeader } from "./content-header";
import { EditBarState, saveBar } from "./edit-bar";

const isNew = (linkedData: LinkedData) => !findHashUri(linkedData);

export const contentComponent: Component<
  {
    contentSaver: ContentSaver;
    ldStoreWrite: LinkedDataStoreWrite;
    ldStoreRead: LinkedDataStoreRead;
    onSave: Consumer<LinkedDataWithHashId>;
    annotationsIndex: AnnotationsIndex["search"];
    creatorProvider: () => string | null;
  },
  {
    displayContent: LinkedDataWithContentAndFragment;
    goToFragment: string;
  }
> = ({
  contentSaver,
  ldStoreWrite,
  ldStoreRead,
  onSave,
  annotationsIndex,
  creatorProvider,
}) => (render) => {
  const storeData = (data: LinkedDataWithContent, retry: () => void) => {
    try {
      updateSaveBar(["saving"]);
      const refError = () =>
        "save article should have hash uri reference to the content";
      contentSaver(data).then(
        link(
          map(pick("linkedData")),
          fork(
            onSave,
            () => updateSaveBar(["hidden"]),
            link(map(findHashUri, throwIfNull2(refError)), setReference)
          )
        )
      );
    } catch (reason) {
      updateSaveBar(["error", { reason, onTryAgain: retry }]);
    }
  };

  const [saveContent, setContextForSave] = withState<LinkedDataWithContent>(
    (data) => {
      if (!isNew(data.linkedData))
        throw new Error("Can only save content that was not saved before");
      storeData(data, saveContent);
    }
  );

  const [saveBarSlot, { updateSaveBar }] = newSlot(
    "save-bar",
    saveBar({
      onSave: saveContent,
    })
  );

  const resetSaveBar = splitMap(
    isNew,
    () => ["visible"] as EditBarState,
    () => ["hidden"] as EditBarState,
    updateSaveBar
  );

  const [
    annotationSupportSlot,
    { displayDocumentAnnotations, setReference, setContainer },
  ] = newSlot(
    "annotation-support",
    annotationsSupport({
      ldStoreWrite,
      ldStoreRead,
      annotationsIndex,
      requestDocumentSave: saveContent,
      creatorProvider,
    })
  );

  const [contentSlot, { displayContent, goToFragment }] = newSlot(
    "content",
    contentDisplayComponent({
      contentSaver,
      onAnnotationDisplayRequest: displayDocumentAnnotations,
    })
  );

  const [contentFieldsSlot, { renderFields }] = newSlot(
    "content-fields",
    contentHeader()
  );

  render(
    div(
      { id: "content-container", class: "ml-4" },
      contentFieldsSlot,
      div(
        {
          id: "content-body",
          class: "mb-3 position-relative",
          onDisplay: link(map(getTarget), setContainer),
        },
        contentSlot,
        annotationSupportSlot
      ),
      saveBarSlot
    )
  );

  return {
    displayContent: fork(
      displayContent,
      setContextForSave,
      link(
        map(pick("linkedData")),
        fork(
          renderFields,
          link(map(findHashUri), fork(setReference)),
          resetSaveBar
        )
      )
    ),
    goToFragment,
  };
};
