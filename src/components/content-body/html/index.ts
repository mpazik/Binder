import { Callback, fork } from "../../../libs/connections";
import { map, pick, wrap } from "../../../libs/connections/mappers";
import { Component, newSlot } from "../../../libs/simple-ui/render";
import { loader } from "../../common/loader";
import { ContentComponent } from "../types";

import { scrollToPageTopWhenNoFragment } from "./utils";
import { processToHtml } from "./utils";
import { HtmlContent, setupHtmlView } from "./view";

const contentComponent: Component<
  {
    onDisplay: Callback<HTMLElement>;
  },
  { renderPage: HtmlContent }
> = ({ onDisplay }) => (render) => {
  const htmlView = setupHtmlView({ onDisplay });

  return {
    renderPage: map(htmlView, render),
  };
};

export const htmlDisplay: ContentComponent = ({ onDisplay }) => (
  render,
  onClose
) => {
  const [contentSlot, { renderPage }] = newSlot(
    "html-content",
    contentComponent({
      onDisplay: map(
        wrap("container"),
        fork(onDisplay, scrollToPageTopWhenNoFragment)
      ),
    })
  );

  const { load } = loader<Blob, HtmlContent>({
    fetcher: processToHtml,
    onLoaded: renderPage,
    contentSlot,
  })(render, onClose);

  return {
    displayContent: map(pick("content"), load),
    goToFragment: () => {
      // handled by browser
    },
  };
};
