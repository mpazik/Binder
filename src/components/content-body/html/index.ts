import { LinkedDataWithContent } from "../../../functions/content-processors";
import {
  getDocumentContentRoot,
  parseArticleContent,
} from "../../../functions/content-processors/html-processor";
import { Consumer } from "../../../libs/connections";
import { Component } from "../../../libs/simple-ui/render";
import { AnnotationDisplayRequest } from "../../annotations";
import { htmlView } from "../html-view";

export const htmlDisplay: Component<
  {
    onAnnotationDisplayRequest: Consumer<AnnotationDisplayRequest>;
    onSelectionTrigger: () => void;
  },
  { displayContent: LinkedDataWithContent }
> = ({ onSelectionTrigger, onAnnotationDisplayRequest }) => (render) => {
  return {
    displayContent: async ({ linkedData, content }) => {
      const contentDocument = parseArticleContent(await content.text());
      const contentRoot = getDocumentContentRoot(contentDocument);
      render(
        htmlView({
          content: contentRoot,
          onDisplay: (container) => {
            onAnnotationDisplayRequest({ linkedData, container });
          },
          sendSelection: onSelectionTrigger,
        })
      );
    },
  };
};
