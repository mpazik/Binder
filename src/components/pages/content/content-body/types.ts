import type { UiComponent } from "linki-ui";

import type { DocFragment } from "../../../annotations/annotation";

export type DisplayContext = {
  container: HTMLElement;
  fragment?: string;
  fragmentForAnnotations?: DocFragment; // that looks a little bit ugly
};

export type AnnotationContext = {
  container: HTMLElement;
  fragment?: DocFragment;
};

export type DisplayController = {
  onDisplay: DisplayContext;
  // onContentModified: Blob;
  onCurrentFragmentResponse: string | undefined;
};
export type ContentComponent = UiComponent<
  {
    displayContent: { content: Blob; fragment?: string };
    goToFragment: string;
    saveComplete?: void;
    requestCurrentFragment?: void;
  },
  DisplayController
>;
