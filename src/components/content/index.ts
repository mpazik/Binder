import {
  link,
  map,
  pick,
  fork,
  withOptionalState,
  Callback,
  withMultiState,
} from "linki";

import { LinkedDataWithContent } from "../../functions/content-processors";
import { ContentSaver } from "../../functions/content-saver";
import { AnnotationsIndex } from "../../functions/indexes/annotations-index";
import { LinkedDataStoreWrite } from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { throwIfNull2 } from "../../libs/errors";
import { HashUri, isHashUri } from "../../libs/hash";
import { LinkedData, LinkedDataWithHashId } from "../../libs/jsonld-format";
import { findHashUri } from "../../libs/linked-data";
import { throwOnNull } from "../../libs/linki";
import { Component, div, newSlot } from "../../libs/simple-ui/render";
import { getTarget } from "../../libs/simple-ui/utils/funtions";
import { annotationsSupport } from "../annotations";
import {
  contentDisplayComponent,
  LinkedDataWithContentAndFragment,
} from "../content-body";
import { createWatchAction } from "../watch-history/watch-action";

import { contentHeader } from "./content-header";
import { EditBarState, saveBar } from "./edit-bar";

const isNew = (linkedData: LinkedData) => !findHashUri(linkedData);

export const contentComponent: Component<
  {
    contentSaver: ContentSaver;
    ldStoreWrite: LinkedDataStoreWrite;
    ldStoreRead: LinkedDataStoreRead;
    onSave: Callback<LinkedDataWithHashId>;
    annotationsIndex: AnnotationsIndex["search"];
    creatorProvider: () => string | null;
    onDisplay: Callback;
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
  onDisplay,
}) => (render, onClose) => {
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
            (ld) => setWatchReference(ld["@id"]),
            link(map(findHashUri, throwIfNull2(refError)), setReference)
          )
        )
      );
    } catch (reason) {
      updateSaveBar(["error", { reason, onTryAgain: retry }]);
    }
  };

  const [saveContent, setContextForSave] = link(
    withOptionalState<LinkedDataWithContent>(),
    throwOnNull(),
    (data) => {
      if (!isNew(data.linkedData))
        throw new Error("Can only save content that was not saved before");
      storeData(data, saveContent);
    }
  );

  const [saveWatchAction, setWatchStartTime, setWatchReference] = link(
    withMultiState<[Date, HashUri], string | undefined>(undefined, undefined),
    ([startTime, hashUri, fragment]) => {
      if (startTime === undefined || hashUri === undefined)
        throw new Error("context undefined");
      if (!isHashUri(hashUri)) return; // ignore not saved pages
      ldStoreWrite(
        createWatchAction(
          hashUri + (fragment ? `#${fragment}` : ""),
          startTime,
          new Date()
        )
      );
    }
  );

  const [saveBarSlot, { updateSaveBar }] = newSlot(
    "save-bar",
    saveBar({
      onSave: saveContent,
    })
  );

  const resetSaveBar = link(
    map<LinkedData, EditBarState>((it) =>
      isNew(it) ? ["visible"] : ["hidden"]
    ),
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

  const [
    contentSlot,
    { displayContent, goToFragment, requestCurrentFragment },
  ] = newSlot(
    "content",
    contentDisplayComponent({
      contentSaver,
      onAnnotationDisplayRequest: displayDocumentAnnotations,
      onCurrentFragmentResponse: saveWatchAction,
      onDisplay,
    })
  );

  const [contentFieldsSlot, { renderFields }] = newSlot(
    "content-fields",
    contentHeader()
  );

  render(
    div(
      { id: "content-container" },
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

  onClose(() => {
    requestCurrentFragment();
  });

  return {
    displayContent: fork(
      () => requestCurrentFragment(),
      displayContent,
      setContextForSave,
      link(
        map(pick("linkedData")),
        fork(
          (linkedData) => {
            setWatchStartTime(new Date());
            setWatchReference(linkedData["@id"] as HashUri);
          },
          renderFields,
          link(map(findHashUri), fork(setReference)),
          resetSaveBar
        )
      )
    ),
    goToFragment,
  };
};
