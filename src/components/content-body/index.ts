import "../display-settings/style.css";

import type { Callback, NamedCallbacks } from "linki";
import {
  defined,
  filter,
  fork,
  link,
  map,
  pick,
  pipe,
  split,
  withOptionalState,
} from "linki";
import type { UiComponent } from "linki-ui";
import { div } from "linki-ui";

import type { LinkedDataWithContent } from "../../functions/content-processors";
import type { ContentSaver } from "../../functions/content-saver";
import type { WatchHistoryIndex } from "../../functions/indexes/watch-history-index";
import {
  browserUriFragmentProvider,
  currentFragment,
} from "../../libs/browser-providers";
import { throwIfUndefined } from "../../libs/errors";
import type { HashUri } from "../../libs/hash";
import type { LinkedData } from "../../libs/jsonld-format";
import {
  epubMediaType,
  getEncoding,
  htmlMediaType,
  pdfMediaType,
} from "../../libs/ld-schemas";
import { indexOf, select, withMultiState } from "../../libs/linki";
import type { AnnotationDisplayRequest } from "../annotations";

import { epubDisplay } from "./epub";
import { htmlDisplay } from "./html";
import { htmlEditableDisplay } from "./html-editable";
import { pdfDisplay } from "./pdf";
import type {
  ContentComponent,
  DisplayContext,
  DisplayController,
} from "./types";

const isEditable: (linkedData: LinkedData) => boolean = () => false;

export const contentDisplayComponent = (
  watchHistoryIndex: WatchHistoryIndex,
  contentSaver: ContentSaver
): UiComponent<
  {
    displayContent: LinkedDataWithContent;
    requestCurrentFragment: void;
  },
  {
    onAnnotationDisplayRequest: AnnotationDisplayRequest;
    onCurrentFragmentResponse: string | undefined;
  }
> => ({ onCurrentFragmentResponse, onAnnotationDisplayRequest, render }) => {
  // multi state with linkedData and fallback for update
  const [saveNewContent, setLinkedDataForSave, setCallbackForUpdate] = link(
    withMultiState<[LinkedData, Callback | undefined], Blob>(
      undefined,
      undefined
    ),
    ([linkedData, callback, blob]) => {
      contentSaver({
        linkedData: throwIfUndefined(linkedData),
        content: blob,
      }).then(() => throwIfUndefined(callback)());
    }
  );

  const [
    requestCurrentFragment,
    setCallbackForReqFragment,
    resetCallbackForReqFragment,
  ] = link(withOptionalState<Callback>(), (requestFragment) =>
    requestFragment?.()
  );

  // content to send last fragment before close
  // put start view date to context
  // figure out epub

  const [closeContentComponent, setCallbackForCloseComponent] = link(
    withOptionalState<Callback>(undefined),
    filter(defined),
    (closeComponent) => {
      closeComponent();
    }
  );

  const displayAnnotations: Callback<DisplayContext> = fork(
    ({ fragmentForAnnotations: fragment, container }) =>
      onAnnotationDisplayRequest({ fragment, textLayer: container })
  );

  const displayController: NamedCallbacks<DisplayController> = {
    onDisplay: displayAnnotations,
    onContentModified: saveNewContent,
    onCurrentFragmentResponse,
  };

  const displayContentComponent = (component: ContentComponent) => async ({
    content,
    linkedData,
  }: LinkedDataWithContent) => {
    closeContentComponent();
    const {
      stop,
      displayContent,
      saveComplete,
      goToFragment,
      requestCurrentFragment,
    } = component({ render, ...displayController });
    setCallbackForCloseComponent(
      fork(stop ?? (() => {}), browserUriFragmentProvider(goToFragment))
    );
    setCallbackForUpdate(saveComplete);
    requestCurrentFragment
      ? setCallbackForReqFragment(requestCurrentFragment)
      : resetCallbackForReqFragment();
    const fragment =
      currentFragment() ??
      (await watchHistoryIndex(linkedData["@id"] as HashUri))?.fragment;
    displayContent({ content, fragment });
  };

  const displayNotSupported = ({ linkedData }: LinkedDataWithContent) => {
    const encodingFormat = `${linkedData["encodingFormat"]}`;
    const message = encodingFormat
      ? `Content type "${encodingFormat}" is not supported`
      : `Document does not define encoding format`;
    render(div({ class: "flash mt-3 flash-error" }, message));
  };

  return {
    stop: closeContentComponent,
    displayContent: fork(
      link(map(pick("linkedData")), setLinkedDataForSave),
      link<LinkedDataWithContent, LinkedDataWithContent[]>(
        select(
          pipe(
            pick("linkedData"),
            getEncoding,
            indexOf([htmlMediaType, pdfMediaType, epubMediaType, undefined])
          )
        ),
        [
          link(split(pipe(pick("linkedData"), isEditable)), [
            displayContentComponent(htmlEditableDisplay),
            displayContentComponent(htmlDisplay),
          ]),
          displayContentComponent(pdfDisplay),
          displayContentComponent(epubDisplay),
          displayNotSupported,
        ]
      )
    ),
    requestCurrentFragment,
  };
};
