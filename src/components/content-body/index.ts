import { LinkedDataWithContent } from "../../functions/content-processors";
import { ContentSaver } from "../../functions/content-saver";
import { updateBrowserHistory } from "../../functions/url-hijack";
import { getUriFragment } from "../../libs/browser-providers";
import {
  Callback,
  Consumer,
  fork,
  passOnlyChanged,
  select,
  split,
  withMultiState,
  withState,
} from "../../libs/connections";
import { and, defined, filter } from "../../libs/connections/filters";
import { map, passUndefined, pick, pipe } from "../../libs/connections/mappers";
import { throwIfUndefined } from "../../libs/errors";
import {
  epubMediaType,
  getEncoding,
  htmlMediaType,
  pdfMediaType,
} from "../../libs/ld-schemas";
import { LinkedData } from "../../libs/linked-data";
import {
  Component,
  div,
  newCloseController,
} from "../../libs/simple-ui/render";
import { AnnotationDisplayRequest } from "../annotations";
import { currentSelection } from "../annotations/selection";

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
    onSelect: Consumer<Range | undefined>;
  },
  {
    displayContent: LinkedDataWithContentAndFragment;
    goToFragment: string;
  }
> = ({ onAnnotationDisplayRequest, onSelect, contentSaver }) => (
  render,
  onClose
) => {
  const sendSelection: Callback<void> = map(
    currentSelection,
    passOnlyChanged(onSelect)
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

  const [
    closeContentComponent,
    [setCallbackForCloseComponent],
  ] = withMultiState<[Callback]>(([closeComponent]) => {
    if (closeComponent) {
      console.log("closing");
      closeComponent();
    }
  }, undefined);

  onClose(closeContentComponent);

  const displayAnnotations: Callback<DisplayContext> = fork(
    ({ fragmentForAnnotations: fragment, container }) =>
      onAnnotationDisplayRequest({ fragment, textLayer: container })
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
    closeContentComponent();
    const [onClose, close] = newCloseController();
    const { displayContent, saveComplete, goToFragment } = component(
      displayController
    )(render, onClose);
    setCallbackForCloseComponent(close);
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
      map(pick("linkedData"), setLinkedDataForSave),
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
