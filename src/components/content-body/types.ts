import type { Callback } from "linki";

import type { Component } from "../../libs/simple-ui/render";
import type { DocFragment } from "../annotations/annotation";

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
  onDisplay: Callback<DisplayContext>;
  onContentModified: Callback<Blob>;
  onCurrentFragmentResponse: Callback<string | undefined>;
};
export type ContentComponent = Component<
  DisplayController,
  {
    displayContent: { content: Blob; fragment?: string };
    goToFragment: string;
    saveComplete?: void;
    requestCurrentFragment?: void;
  }
>;
