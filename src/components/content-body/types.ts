import { Callback } from "../../libs/connections";
import { Component } from "../../libs/simple-ui/render";
import { DocFragment } from "../annotations/annotation";

export type DisplayContext = {
  container: HTMLElement;
  fragment?: string;
  fragmentForAnnotations?: DocFragment;
};

export type AnnotationContext = {
  container: HTMLElement;
  fragment?: DocFragment;
};

export type DisplayController = {
  onDisplay: Callback<DisplayContext>;
  onSelectionTrigger: () => void;
  onContentModified: Callback<Blob>;
};
export type ContentComponent = Component<
  DisplayController,
  {
    displayContent: { content: Blob; fragment?: string };
    goToFragment: string;
    saveComplete?: void;
  }
>;
