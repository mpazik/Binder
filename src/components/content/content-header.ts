import { URL } from "schema-dts";

import { findUrl, LinkedData } from "../../libs/linked-data";
import { a, Component, div, span, View } from "../../libs/simple-ui/render";

const contentHeaderView: View<LinkedData> = (linkedData: LinkedData) => {
  const uri = findUrl(linkedData);
  return div(
    { class: "Subhead" },
    div({ class: "Subhead-heading" }, String(linkedData.name)),
    div(
      { class: "Subhead-description" },
      ...(uri
        ? [
            span(
              "From: ",
              a({ href: uri, target: "_blank" }, new URL(uri).hostname)
            ),
          ]
        : [])
    )
  );
};

export const contentHeader: Component<
  void,
  { renderFields: LinkedData }
> = () => (render) => ({
  renderFields: (linkedData) => render(contentHeaderView(linkedData)),
});
