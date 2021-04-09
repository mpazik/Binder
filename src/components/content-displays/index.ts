import { LinkedDataWithContent } from "../../functions/content-processors";
import { ContentSaver } from "../../functions/content-saver";
import {
  Callback,
  Consumer,
  passOnlyChanged,
  select,
  split,
  withState,
} from "../../libs/connections";
import { map, passUndefined, pick, pipe } from "../../libs/connections/mappers";
import {
  epubMediaType,
  getEncoding,
  htmlMediaType,
  pdfMediaType,
} from "../../libs/ld-schemas";
import { LinkedData } from "../../libs/linked-data";
import { Component, div, newSlot } from "../../libs/simple-ui/render";
import { AnnotationDisplayRequest } from "../annotations";
import { currentSelection, OptSelection } from "../annotations/selection";

import { epubDisplay } from "./epub/idnex";
import { htmlDisplay } from "./html";
import { htmlEdiableDisplay } from "./html-editable";
import { pdfDisplay } from "./pdf";

const isEditable: (linkedData: LinkedData) => boolean = () => true;

export const contentDisplayComponent: Component<
  {
    contentSaver: ContentSaver;
    onAnnotationDisplayRequest: Consumer<AnnotationDisplayRequest>;
    onSelect: Consumer<OptSelection>;
  },
  {
    displayContent: LinkedDataWithContent;
  }
> = ({ onAnnotationDisplayRequest, onSelect, contentSaver }) => (render) => {
  const [sendSelection, setContainerForSelect] = withState<HTMLElement>(
    map(currentSelection, passOnlyChanged(onSelect))
  );

  const displayAnnotations: Callback<AnnotationDisplayRequest> = (data) => {
    onAnnotationDisplayRequest(data);
    setContainerForSelect(data.container);
    // todo scroll to top
  };

  const [htmlDisplaySlot, { displayContent: updateHtmlContent }] = newSlot(
    "html-display",
    htmlDisplay({
      onAnnotationDisplayRequest: displayAnnotations,
      onSelectionTrigger: sendSelection,
    })
  );

  const displayHtml = async (content: LinkedDataWithContent) => {
    console.log("display html");
    render(div(htmlDisplaySlot));
    updateHtmlContent(content);
  };

  const [
    htmlEditableDisplaySlot,
    { displayContent: updateHtmlEditableContent },
  ] = newSlot(
    "html-editable-display",
    htmlEdiableDisplay({
      contentSaver,
      onAnnotationDisplayRequest: displayAnnotations,
      onSelectionTrigger: sendSelection,
    })
  );

  const displayHtmlEdiable = async (content: LinkedDataWithContent) => {
    console.log("display html editable");
    render(div(htmlEditableDisplaySlot));
    updateHtmlEditableContent(content);
  };

  const [pdfDisplaySlot, { displayContent: updatePdfContent }] = newSlot(
    "pdf-display",
    pdfDisplay({
      onAnnotationDisplayRequest: displayAnnotations,
      onSelectionTrigger: sendSelection,
    })
  );

  const displayPdf = (content: LinkedDataWithContent) => {
    render(div(pdfDisplaySlot));
    updatePdfContent(content);
  };

  const [epubDisplaySlot, { displayContent: updateEpubContent }] = newSlot(
    "epub-display",
    epubDisplay({
      onAnnotationDisplayRequest: displayAnnotations,
      onSelectionTrigger: sendSelection,
    })
  );

  const displayEpub = async (content: LinkedDataWithContent) => {
    render(div(epubDisplaySlot));
    updateEpubContent(content);
  };

  const displayNotSupported = ({ linkedData }: LinkedDataWithContent) => {
    render(
      div(`Content type ${linkedData["encodingFormat"]} is not supported`)
    );
  };

  return {
    displayContent: select<LinkedDataWithContent, string | undefined>(
      pipe(pick("linkedData"), passUndefined(getEncoding)),
      [
        [
          htmlMediaType,
          split(
            pipe(pick("linkedData"), isEditable),
            displayHtmlEdiable,
            displayHtml
          ),
        ],
        [pdfMediaType, displayPdf],
        [epubMediaType, displayEpub],
      ],
      displayNotSupported
    ),
  };
};
