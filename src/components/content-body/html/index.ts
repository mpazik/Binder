import { Callback, fork } from "../../../libs/connections";
import { map, pick, wrap } from "../../../libs/connections/mappers";
import { Component, div, newSlot } from "../../../libs/simple-ui/render";
import { loader } from "../../common/loader";
import { ContentComponent } from "../types";

import { scrollToPageTopWhenNoFragment } from "./utils";
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
    renderPage: map(
      (it) => div(div({ style: { height: 100 } }), htmlView(it)),
      render
    ),
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
