import { Callback } from "../../libs/connections";
import { Component } from "../../libs/simple-ui/render";

export type AnnotationContext = {
  container: HTMLElement;
  fragment?: string;
};

export type DisplayController = {
  onDisplay: Callback<AnnotationContext>;
  onSelectionTrigger: () => void;
  onContentModified: Callback<Blob>;
};
export type ContentComponent = Component<
  DisplayController,
  { displayContent: Blob; saveComplete?: void }
>;
