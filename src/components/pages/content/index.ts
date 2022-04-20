import { div, dom, mountComponent, renderJsonHtmlToDom } from "linki-ui";

import { throwIfNull } from "../../../libs/errors";
import { annotationsSupport } from "../../annotations";
import type { PageView } from "../../system/page";

import { contentDisplayComponent } from "./content-body";
import { contentHeader } from "./content-header";

export const contentComponent: PageView = (controls, data) => {
  const linkedData = throwIfNull(data);
  const reference = throwIfNull(linkedData["@id"]);

  const [
    annotationSupportSlot,
    { displayDocumentAnnotations, setContainer: setAnnotationContainer },
  ] = mountComponent(annotationsSupport(controls, reference));

  const [contentSlot] = mountComponent(
    contentDisplayComponent(controls, linkedData),
    {
      onAnnotationDisplayRequest: displayDocumentAnnotations,
    }
  );

  const containerDom = renderJsonHtmlToDom(
    div(
      {
        id: "content-container",
      },
      contentHeader(controls, linkedData),
      div(
        {
          id: "content-body",
        },
        contentSlot
      ),
      annotationSupportSlot
    )
  ) as HTMLElement;
  setAnnotationContainer(containerDom);
  return dom(containerDom);
};
