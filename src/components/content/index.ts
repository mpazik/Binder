import { LinkedDataWithContent } from "../../functions/content-processors";
import { createContentSaver } from "../../functions/content-saver";
import { AnnotationsIndex } from "../../functions/indexes/annotations-index";
import {
  LinkedDataStoreWrite,
  ResourceStoreWrite,
} from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { Consumer, fork, splitMap, withState } from "../../libs/connections";
import { map, pick, pipe } from "../../libs/connections/mappers";
import { throwIfNull2 } from "../../libs/errors";
import {
  findHashUri,
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/linked-data";
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
    storeWrite: ResourceStoreWrite;
    ldStoreWrite: LinkedDataStoreWrite;
    ldStoreRead: LinkedDataStoreRead;
    onSave: Consumer<LinkedDataWithHashId>;
    annotationsIndex: AnnotationsIndex["search"];
  },
  {
    setCreator: string | undefined;
    displayContent: LinkedDataWithContentAndFragment;
    goToFragment: string;
  }
> = ({ storeWrite, ldStoreWrite, ldStoreRead, onSave, annotationsIndex }) => (
  render
) => {
  const contentSaver = createContentSaver(storeWrite, ldStoreWrite);
  const storeData = (data: LinkedDataWithContent, retry: () => void) => {
    try {
      updateSaveBar(["saving"]);
      const refError = () =>
        "save article should have hash uri reference to the content";
      contentSaver(data).then(
        map(
          pick("linkedData"),
          fork(
            onSave,
            () => updateSaveBar(["hidden"]),
            map(pipe(findHashUri, throwIfNull2(refError)), setReference)
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
    { displayDocumentAnnotations, setCreator, setReference, setContainer },
  ] = newSlot(
    "annotation-support",
    annotationsSupport({
      ldStoreWrite,
      ldStoreRead,
      annotationsIndex,
      requestDocumentSave: saveContent,
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
          onDisplay: map(getTarget, setContainer),
        },
        contentSlot,
        annotationSupportSlot
      ),
      saveBarSlot
    )
  );

  return {
    setCreator,
    displayContent: fork(
      displayContent,
      setContextForSave,
      map(
        pick("linkedData"),
        fork(renderFields, map(findHashUri, fork(setReference)), resetSaveBar)
      )
    ),
    goToFragment,
  };
};
