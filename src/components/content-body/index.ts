import {
  Callback,
  defined,
  definedTuple,
  filter,
  fork,
  ignoreParam,
  link,
  map,
  pick,
  pipe,
  split,
  withMultiState,
  withOptionalState,
} from "linki";
import { valueWithOptionalState } from "linki/dist/processors/reduce";

import { LinkedDataWithContent } from "../../functions/content-processors";
import { ContentSaver } from "../../functions/content-saver";
import { throwIfUndefined } from "../../libs/errors";
import { LinkedData } from "../../libs/jsonld-format";
import {
  epubMediaType,
  getEncoding,
  htmlMediaType,
  pdfMediaType,
} from "../../libs/ld-schemas";
import { indexOf, select } from "../../libs/linki";
import {
  Component,
  div,
  newCloseController,
} from "../../libs/simple-ui/render";
import { AnnotationDisplayRequest } from "../annotations";

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
    onAnnotationDisplayRequest: Callback<AnnotationDisplayRequest>;
    onCurrentFragmentResponse: Callback<string | undefined>;
    onDisplay: Callback;
  },
  {
    displayContent: LinkedDataWithContentAndFragment;
    goToFragment: string;
    requestCurrentFragment: void;
  }
> = ({
  onCurrentFragmentResponse,
  onAnnotationDisplayRequest,
  contentSaver,
  onDisplay,
}) => (render, onClose) => {
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

  const [goToFragment, setCallbackForFragment] = link(
    valueWithOptionalState<Callback<string>, string>(undefined),
    filter(definedTuple),
    ([goToFragment, fragment]) => {
      goToFragment(fragment);
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

  onClose(closeContentComponent);

  const displayAnnotations: Callback<DisplayContext> = fork(
    ({ fragmentForAnnotations: fragment, container }) =>
      onAnnotationDisplayRequest({ fragment, textLayer: container })
  );

  const displayController: DisplayController = {
    onDisplay: fork(displayAnnotations, link(ignoreParam(), onDisplay)),
    onContentModified: saveNewContent,
    onCurrentFragmentResponse,
  };

  const displayContentComponent = (component: ContentComponent) => ({
    content,
    fragment,
  }: LinkedDataWithContentAndFragment) => {
    closeContentComponent();
    const [onClose, close] = newCloseController();
    const {
      displayContent,
      saveComplete,
      goToFragment,
      requestCurrentFragment,
    } = component(displayController)(render, onClose);
    setCallbackForCloseComponent(close);
    setCallbackForUpdate(saveComplete);
    setCallbackForFragment(goToFragment);
    requestCurrentFragment
      ? setCallbackForReqFragment(requestCurrentFragment)
      : resetCallbackForReqFragment();
    displayContent({ content, fragment });
  };

  const displayNotSupported = ({ linkedData }: LinkedDataWithContent) => {
    render(
      div(`Content type ${linkedData["encodingFormat"]} is not supported`)
    );
  };

  return {
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
    goToFragment,
    requestCurrentFragment,
  };
};
