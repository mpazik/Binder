import { LinkedDataWithContent } from "../../functions/content-processors";
import { ContentSaver } from "../../functions/content-saver";
import { updateBrowserHistory } from "../../functions/url-hijack";
import { getUriFragment } from "../../libs/browser-providers";
import {
  Callback,
  combineAlways,
  Consumer,
  fork,
  passOnlyChanged,
  select,
  split,
  withMultiState,
  withState,
} from "../../libs/connections";
import {
  and,
  defined,
  definedTuple,
  filter,
} from "../../libs/connections/filters";
import {
  map,
  passUndefined,
  pick,
  pipe,
  to,
} from "../../libs/connections/mappers";
import { throwIfUndefined } from "../../libs/errors";
import { HashUri } from "../../libs/hash";
import {
  epubMediaType,
  getEncoding,
  htmlMediaType,
  pdfMediaType,
} from "../../libs/ld-schemas";
import { findHashUri, LinkedData } from "../../libs/linked-data";
import { Component, div } from "../../libs/simple-ui/render";
import { AnnotationDisplayRequest } from "../annotations";
import { currentSelection, OptSelection } from "../annotations/selection";

import { epubDisplay } from "./epub";
import { htmlDisplay } from "./html";
import { htmlEditableDisplay } from "./html-editable";
import { pdfDisplay } from "./pdf";
import { ContentComponent, DisplayContext, DisplayController } from "./types";

const isEditable: (linkedData: LinkedData) => boolean = () => false;

export type LinkedDataWithContentAndFragment = LinkedDataWithContent & {
  fragment?: string;
};

export const contentDisplayComponent: Component<
  {
    contentSaver: ContentSaver;
    onAnnotationDisplayRequest: Consumer<AnnotationDisplayRequest>;
    onSelect: Consumer<OptSelection>;
  },
  {
    displayContent: LinkedDataWithContentAndFragment;
    goToFragment: string;
  }
> = ({ onAnnotationDisplayRequest, onSelect, contentSaver }) => (
  render,
  onClose
) => {
  const [
    sendChangedSelection,
    [setAnnotationContextForSelect],
  ] = withMultiState<[DisplayContext], Range | undefined>(
    ([annotationContext], range) => {
      if (annotationContext) {
        const {
          container,
          fragmentForAnnotations: fragment,
        } = annotationContext;
        range ? onSelect({ container, fragment, range }) : onSelect(undefined);
      }
    },
    undefined
  );

  const sendSelection: Callback<void> = map(
    currentSelection,
    passOnlyChanged(sendChangedSelection)
  );

  const [setReference, setAnnotationContextForDisplay] = combineAlways<
    [HashUri | undefined, DisplayContext | undefined]
  >(
    filter(
      definedTuple,
      map(([reference, { container, fragmentForAnnotations: fragment }]) => {
        return {
          container,
          reference,
          fragment,
        };
      }, onAnnotationDisplayRequest)
    ),
    undefined,
    undefined
  );

  // multi state with linkedData and fallback for update
  const [
    saveNewContent,
    [setLinkedDataForSave, setCallbackForUpdate],
  ] = withMultiState<[LinkedData, Callback | undefined], Blob>(
    ([linkedData, callback], blob) => {
      contentSaver({
        linkedData: throwIfUndefined(linkedData),
        content: blob,
      }).then(() => throwIfUndefined(callback)());
    },
    undefined,
    undefined
  );

  const [goToFragment, setCallbackForFragment] = withState<
    Callback<string>,
    string
  >((goToFragment, fragment) => {
    goToFragment(fragment);
  }, undefined);

  const displayAnnotations: Callback<DisplayContext> = fork(
    setAnnotationContextForSelect,
    setAnnotationContextForDisplay
  );

  const updateHistory: Callback<DisplayContext> = map(
    pick("fragment"),
    filter(
      and(defined, (fragment) => fragment !== getUriFragment()),
      map(
        (fragment: string | undefined) => ({
          fragment: fragment!,
          uri: undefined,
        }),
        updateBrowserHistory
      )
    )
  );

  const displayController: DisplayController = {
    onDisplay: fork(displayAnnotations, updateHistory),
    onSelectionTrigger: sendSelection,
    onContentModified: saveNewContent,
  };

  const displayContentComponent = (component: ContentComponent) => ({
    content,
    fragment,
  }: LinkedDataWithContentAndFragment) => {
    const { displayContent, saveComplete, goToFragment } = component(
      displayController
    )(render, onClose);
    setCallbackForUpdate(saveComplete);
    setCallbackForFragment(goToFragment);
    displayContent({ content, fragment });
  };

  const displayNotSupported = ({ linkedData }: LinkedDataWithContent) => {
    render(
      div(`Content type ${linkedData["encodingFormat"]} is not supported`)
    );
  };

  return {
    displayContent: fork(
      map(to(undefined), setAnnotationContextForDisplay),
      map(
        pick("linkedData"),
        fork(map(findHashUri, setReference), setLinkedDataForSave)
      ),
      select<LinkedDataWithContent, string | undefined>(
        pipe(pick("linkedData"), passUndefined(getEncoding)),
        [
          [
            htmlMediaType,
            split(
              pipe(pick("linkedData"), isEditable),
              displayContentComponent(htmlEditableDisplay),
              displayContentComponent(htmlDisplay)
            ),
          ],
          [pdfMediaType, displayContentComponent(pdfDisplay)],
          [epubMediaType, displayContentComponent(epubDisplay)],
        ],
        displayNotSupported
      )
    ),
    goToFragment,
  };
};
