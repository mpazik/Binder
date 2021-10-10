import { link, map } from "linki";

import { CATEGORIES_ENABLED } from "../../config";
import type { LinkedData } from "../../libs/jsonld-format";
import { findUrl } from "../../libs/linked-data";
import type { Component, Slot, ViewSetup } from "../../libs/simple-ui/render";
import { a, div, newSlot, span } from "../../libs/simple-ui/render";
import { multiSelect } from "../common/multi-select";

const newContentHeader: ViewSetup<{ categoriesSlot: Slot }, LinkedData> = ({
  categoriesSlot,
}) => (linkedData: LinkedData) => {
  const uri = findUrl(linkedData);
  return div(
    { class: "Subhead with-line-length-settings" },
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
        : []),
      ...(CATEGORIES_ENABLED ? [categoriesSlot] : [])
    )
  );
};

export const contentHeader: Component<
  void,
  { renderFields: LinkedData }
> = () => (render) => {
  const [categoriesSlot] = newSlot("categories", multiSelect({}));

  const containerHeaderView = newContentHeader({
    categoriesSlot,
  });

  return {
    renderFields: link(map(containerHeaderView), render),
  };
};
