import { LinkedDataWithContent } from "../../functions/content-processors";
import { ContentSaver } from "../../functions/content-saver";
import {
  Callback,
  combineAlways,
  Consumer,
  fork,
  passOnlyChanged,
  select,
  split,
  withMultiState,
} from "../../libs/connections";
import { definedTuple, filter } from "../../libs/connections/filters";
import { map, passUndefined, pick, pipe } from "../../libs/connections/mappers";
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
import {
  AnnotationContext,
  ContentComponent,
  DisplayController,
} from "./types";

const isEditable: (linkedData: LinkedData) => boolean = () => false;

export const contentDisplayComponent: Component<
  {
    contentSaver: ContentSaver;
    onAnnotationDisplayRequest: Consumer<AnnotationDisplayRequest>;
    onSelect: Consumer<OptSelection>;
  },
  {
    displayContent: LinkedDataWithContent;
  }
> = ({ onAnnotationDisplayRequest, onSelect, contentSaver }) => (
  render,
  onClose
) => {
  const [
    sendChangedSelection,
    [setAnnotationContextForSelect],
  ] = withMultiState<[AnnotationContext], Range | undefined>(
    ([annotationContext], range) => {
      if (annotationContext) {
        const { container, fragment } = annotationContext;
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
    [HashUri | undefined, AnnotationContext | undefined]
  >(
    filter(
      definedTuple,
      map(
        ([reference, { container, fragment }]) => ({
          container,
          reference,
          fragment,
        }),
        onAnnotationDisplayRequest
      )
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

  const displayAnnotations: Callback<AnnotationContext> = fork(
    setAnnotationContextForSelect,
    setAnnotationContextForDisplay
  );

  const displayController: DisplayController = {
    onDisplay: displayAnnotations,
    onSelectionTrigger: sendSelection,
    onContentModified: saveNewContent,
  };

  const displayContentComponent = (component: ContentComponent) => ({
    content,
  }: LinkedDataWithContent) => {
    const { displayContent, saveComplete } = component(displayController)(
      render,
      onClose
    );
    setCallbackForUpdate(saveComplete);
    displayContent(content);
  };

  const displayNotSupported = ({ linkedData }: LinkedDataWithContent) => {
    render(
      div(`Content type ${linkedData["encodingFormat"]} is not supported`)
    );
  };

  return {
    displayContent: fork(
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
  };
};
