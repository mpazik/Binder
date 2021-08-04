import {
  Callback,
  defined,
  filter,
  fork,
  link,
  map,
  pick,
  valueWithState,
  withOptionalState,
  wrap,
} from "linki";

import { Component, newSlot } from "../../../libs/simple-ui/render";
import { loader } from "../../common/loader";
import { ContentComponent } from "../types";
import { lastSeenElement, scrollToFragmentOrTop } from "../utils";

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
    renderPage: link(map(htmlView), render),
  };
};

export const htmlDisplay: ContentComponent = ({
  onDisplay,
  onCurrentFragmentResponse,
}) => (render, onClose) => {
  const [contentSlot, { renderPage }] = newSlot(
    "html-content",
    contentComponent({
      onDisplay: fork(
        (it) => goToFragment(it),
        (it) => setContainerContext(it),
        link(map(wrap("container")), onDisplay)
      ),
    })
  );

  const [returnCurrentFragment, setContainerContext] = link(
    withOptionalState<HTMLElement>(undefined),
    filter(defined),
    map(lastSeenElement, (it) => it?.id),
    onCurrentFragmentResponse
  );

  const [goToFragment, setFragment] = link(
    valueWithState<string | undefined, HTMLElement>(undefined),
    ([fragment]) => {
      scrollToFragmentOrTop(undefined, fragment);
    }
  );

  const { load } = loader<Blob, HtmlContent>({
    fetcher: processToHtml,
    onLoaded: renderPage,
    contentSlot,
  })(render, onClose);

  return {
    displayContent: fork(
      link(map(pick("content")), load),
      link(map(pick("fragment")), setFragment)
    ),
    goToFragment: () => {
      // handled by browser
    },
    requestCurrentFragment: returnCurrentFragment,
  };
};
