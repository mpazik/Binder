import { fork, link, map, pick, withOptionalState } from "linki";
import type { UiComponent } from "linki-ui";
import { div, dom, mountComponent, renderJsonHtmlToDom } from "linki-ui";

import type { LinkedDataWithContent } from "../../functions/content-processors";
import { createContentSaver } from "../../functions/content-saver";
import { throwIfNull2 } from "../../libs/errors";
import type { HashUri } from "../../libs/hash";
import { isHashUri } from "../../libs/hash";
import type { LinkedData } from "../../libs/jsonld-format";
import { findHashUri, getUrls } from "../../libs/linked-data";
import { throwOnNull, withMultiState } from "../../libs/linki";
import { annotationsSupport } from "../annotations";
import type { EntityViewControls } from "../app/entity-view";
import { isLocalUri } from "../common/uri";
import { contentDisplayComponent } from "../content-body";
import { createWatchAction } from "../watch-history/watch-action";

import { contentHeader } from "./content-header";
import type { EditBarState } from "./edit-bar";
import { saveBar } from "./edit-bar";

const isExisting = (linkedData: LinkedData) => {
  const urls = getUrls(linkedData);
  return urls.some((it) => isHashUri(it)) || urls.some((it) => isLocalUri(it));
};

export const contentComponent = ({
  readAppContext,
  saveLinkedData,
  saveLinkedDataManually,
  readLinkedData,
  saveResource,
  subscribe: { annotations: subscribeAnnotations },
  search: { watchHistoryIndex },
}: EntityViewControls): UiComponent<{
  displayContent: LinkedDataWithContent;
}> => ({ render }) => {
  const contentSaver = createContentSaver(saveResource, saveLinkedDataManually);
  const storeData = (data: LinkedDataWithContent, retry: () => void) => {
    try {
      updateSaveBar(["saving"]);
      const refError = () =>
        "save article should have hash uri reference to the content";
      contentSaver(data).then(
        link(
          map(pick("linkedData")),
          fork(
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

  const [saveBarSlot, { updateSaveBar }] = mountComponent(saveBar, {
    onSave: saveContent,
  });

  const resetSaveBar = link(
    map<LinkedData, EditBarState>((it) =>
      isExisting(it) ? ["hidden"] : ["visible"]
    ),
    updateSaveBar
  );

  const [
    annotationSupportSlot,
    { displayDocumentAnnotations, setReference, setContainer },
  ] = mountComponent(
    annotationsSupport({
      readLinkedData,
      saveLinkedData,
      subscribeAnnotations,
      readAppContext,
    }),
    { requestDocumentSave: saveContent }
  );

  const [
    contentSlot,
    { displayContent, requestCurrentFragment },
  ] = mountComponent(contentDisplayComponent(watchHistoryIndex, contentSaver), {
    onAnnotationDisplayRequest: displayDocumentAnnotations,
    onCurrentFragmentResponse: saveWatchAction,
  });

  const [contentFieldsSlot, { renderFields }] = mountComponent(contentHeader);
  const containerDom = renderJsonHtmlToDom(
    div(
      {
        id: "content-container",
        class: "mb-3 position-relative px-4",
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
  ) as HTMLElement;
  render(dom(containerDom));
  setContainer(containerDom);
  return {
    stop: requestCurrentFragment,
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
  };
};
