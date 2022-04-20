import {
  cast,
  defined,
  filter,
  fork,
  link,
  logIt,
  map,
  pick,
  valueWithState,
  withOptionalState,
  wrap,
} from "linki";
import type { UiComponent } from "linki-ui";
import { dom, mountComponent, renderJsonHtmlToDom } from "linki-ui";

import { loader } from "../../common/loader";
import type { ContentComponent } from "../types";
import { lastSeenElement, scrollToFragmentOrTop } from "../utils";

import { processToHtml } from "./utils";
import { htmlView } from "./view";

const contentComponent: UiComponent<
  { renderPage: Node },
  {
    onDisplay: HTMLElement;
  }
> = ({ onDisplay, render }) => ({
  renderPage: link(
    logIt("renderPage"),
    map(
      wrap("content"),
      htmlView,
      renderJsonHtmlToDom,
      cast<Node, HTMLElement>()
    ),
    fork(link(map(dom), render), onDisplay)
  ),
});

export const htmlDisplay: ContentComponent = ({
  onDisplay,
  onCurrentFragmentResponse,
  render,
}) => {
  const [contentSlot, { renderPage }] = mountComponent(contentComponent, {
    onDisplay: fork<HTMLElement>(
      (it) => goToFragment(it),
      (it) => setContainerContext(it),
      link(map(wrap("container")), onDisplay)
    ),
  });

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

  const { load, stop } = loader<Blob, Node>({
    fetcher: processToHtml,
    onLoaded: renderPage,
    contentView: () => contentSlot,
  })({ render });

  return {
    stop,
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
