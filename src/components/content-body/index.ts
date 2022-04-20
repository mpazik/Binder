import "../display-settings/style.css";

import type { Callback, NamedCallbacks } from "linki";
import {
  defined,
  filter,
  fork,
  link,
  pick,
  pipe,
  split,
  withOptionalState,
} from "linki";
import type { UiComponent } from "linki-ui";
import { div } from "linki-ui";

import type { LinkedDataWithContent } from "../../functions/content-processors";
import { createLinkedDataContentFetcher } from "../../functions/linked-data-fetcher";
import {
  browserUriFragmentProvider,
  currentFragment,
} from "../../libs/browser-providers";
import { throwIfNull } from "../../libs/errors";
import type { HashUri } from "../../libs/hash";
import { isHashUri } from "../../libs/hash";
import type { LinkedData } from "../../libs/jsonld-format";
import {
  epubMediaType,
  getEncoding,
  htmlMediaType,
  pdfMediaType,
} from "../../libs/ld-schemas";
import { indexOf, select, withMultiState } from "../../libs/linki";
import type { AnnotationDisplayRequest } from "../annotations";
import type { PageControls } from "../app/entity-view";
import { createWatchAction } from "../watch-history/watch-action";

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
  { saveLinkedData, readResource, search: { watchHistoryIndex } }: PageControls,
  linkedData: LinkedData
): UiComponent<
  {},
  {
    onAnnotationDisplayRequest: AnnotationDisplayRequest;
  }
> => ({ onAnnotationDisplayRequest, render }) => {
  const contentFetcher = createLinkedDataContentFetcher(readResource);
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

  const displayController: NamedCallbacks<DisplayController> = {
    onDisplay: displayAnnotations,
    onCurrentFragmentResponse: saveWatchAction,
  };

  const displayContentComponent = (component: ContentComponent) => async ({
    content,
    linkedData,
  }: LinkedDataWithContent) => {
    closeContentComponent();
    const {
      stop,
      displayContent,
      goToFragment,
      requestCurrentFragment,
    } = component({ render, ...displayController });
    setCallbackForCloseComponent(
      fork(stop ?? (() => {}), browserUriFragmentProvider(goToFragment))
    );
    requestCurrentFragment
      ? setCallbackForReqFragment(requestCurrentFragment)
      : resetCallbackForReqFragment();
    const fragment =
      currentFragment() ??
      (await watchHistoryIndex(linkedData["@id"] as HashUri))?.fragment;
    displayContent({ content: throwIfNull(content), fragment });
  };

  const displayNotSupported = ({ linkedData }: LinkedDataWithContent) => {
    const encodingFormat = `${linkedData["encodingFormat"]}`;
    const message = encodingFormat
      ? `Content type "${encodingFormat}" is not supported`
      : `Document does not define encoding format`;
    render(div({ class: "flash mt-3 flash-error" }, message));
  };

  setWatchStartTime(new Date());
  setWatchReference(linkedData["@id"] as HashUri);

  const pushData = link<LinkedDataWithContent, LinkedDataWithContent[]>(
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
  );
  contentFetcher(linkedData)
    .then((content) => {
      pushData({ linkedData, content });
    })
    .catch((error) => {
      console.error(error);
    });

  return {
    stop: fork(closeContentComponent, requestCurrentFragment),
  };
};
