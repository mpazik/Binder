import { Callback } from "../../../libs/connections";
import { map, wrap } from "../../../libs/connections/mappers";
import { Component, newSlot } from "../../../libs/simple-ui/render";
import { loader } from "../../common/loader";
import { ContentComponent } from "../types";

import { processToHtml } from "./utils";
import { HtmlContent, setupHtmlView } from "./view";

const contentComponent: Component<
  {
    onSelectionTrigger: () => void;
    onDisplay: Callback<HTMLElement>;
  },
  { renderPage: HtmlContent }
> = ({ onDisplay, onSelectionTrigger }) => (render) => {
  const htmlView = setupHtmlView({ onDisplay, onSelectionTrigger });

  return {
    renderPage: map(htmlView, render),
  };
};

export const htmlDisplay: ContentComponent = ({
  onSelectionTrigger,
  onDisplay,
}) => (render, onClose) => {
  const [contentSlot, { renderPage }] = newSlot(
    "html-content",
    contentComponent({
      onSelectionTrigger,
      onDisplay: map(wrap("container"), onDisplay),
    })
  );

  const { load } = loader<Blob, HtmlContent>({
    fetcher: processToHtml,
    onLoaded: renderPage,
    contentSlot,
  })(render, onClose);

  return {
    displayContent: load,
  };
};
