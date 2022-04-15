import type { Callback } from "linki";
import { fork, link, map, pick, withOptionalState } from "linki";

import type { AppContextProvider } from "../../functions/app-context";
import type { LinkedDataWithContent } from "../../functions/content-processors";
import type { ContentSaver } from "../../functions/content-saver";
import type { AnnotationsSubscribe } from "../../functions/indexes/annotations-index";
import type { LinkedDataStoreRead } from "../../functions/store/local-store";
import { throwIfNull2 } from "../../libs/errors";
import type { HashUri } from "../../libs/hash";
import { isHashUri } from "../../libs/hash";
import type {
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/jsonld-format";
import { findHashUri, getUrls } from "../../libs/linked-data";
import { throwOnNull, withMultiState } from "../../libs/linki";
import type { Component } from "../../libs/simple-ui/render";
import { div, newSlot } from "../../libs/simple-ui/render";
import { getTarget } from "../../libs/simple-ui/utils/funtions";
import { annotationsSupport } from "../annotations";
import { isLocalUri } from "../common/uri";
import type { LinkedDataWithContentAndFragment } from "../content-body";
import { contentDisplayComponent } from "../content-body";
import { createWatchAction } from "../watch-history/watch-action";

import { contentHeader } from "./content-header";
import type { EditBarState } from "./edit-bar";
import { saveBar } from "./edit-bar";

const isExisting = (linkedData: LinkedData) => {
  const urls = getUrls(linkedData);
  return urls.some((it) => isHashUri(it)) || urls.some((it) => isLocalUri(it));
};

export const contentComponent: Component<
  {
    contentSaver: ContentSaver;
    saveLinkedData: Callback<LinkedData>;
    ldStoreRead: LinkedDataStoreRead;
    onSave: Callback<LinkedDataWithHashId>;
    annotationSubscribe: AnnotationsSubscribe;
    onDisplay: Callback;
    contextProvider: AppContextProvider;
  },
  {
    displayContent: LinkedDataWithContentAndFragment;
    goToFragment: string;
  }
> = ({
  contentSaver,
  saveLinkedData,
  ldStoreRead,
  onSave,
  onDisplay,
  contextProvider,
  annotationSubscribe,
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
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      updateSaveBar(["error", { reason, onTryAgain: retry }]);
    }
  };

  const [saveContent, setContextForSave] = link(
    withOptionalState<LinkedDataWithContent>(),
    throwOnNull(),
    (data) => {
      if (isExisting(data.linkedData))
        throw new Error("Can only save content that was not saved before");
      storeData(data, () => saveContent());
    }
  );

  const [saveWatchAction, setWatchStartTime, setWatchReference] = link(
    withMultiState<[Date, HashUri], string | undefined>(undefined, undefined),
    ([startTime, hashUri, fragment]) => {
      if (startTime === undefined || hashUri === undefined)
        throw new Error("context undefined");
      if (!isHashUri(hashUri)) return; // ignore not saved pages
      saveLinkedData(
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
      isExisting(it) ? ["hidden"] : ["visible"]
    ),
    updateSaveBar
  );

  const [
    annotationSupportSlot,
    { displayDocumentAnnotations, setReference, setContainer },
  ] = newSlot(
    "annotation-support",
    annotationsSupport({
      readLd: ldStoreRead,
      saveLinkedData,
      annotationSubscribe,
      contextProvider,
      requestDocumentSave: saveContent,
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
      {
        id: "content-container",
        class: "mb-3 position-relative px-4",
        onDisplay: link(map(getTarget), setContainer),
      },
      contentFieldsSlot,
      div(
        {
          id: "content-body",
        },
        contentSlot
      ),
      annotationSupportSlot,
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
