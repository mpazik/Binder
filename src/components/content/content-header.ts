import { link, map } from "linki";
import type { JsonHtml, UiComponent, View } from "linki-ui";
import { a, div, mountComponent, span } from "linki-ui";

import { CATEGORIES_ENABLED } from "../../config";
import type { LinkedData } from "../../libs/jsonld-format";
import { findUrl } from "../../libs/linked-data";
import { multiSelect } from "../common/multi-select";
import { isLocalUri } from "../common/uri";

const newContentHeader = ({
  categoriesSlot,
}: {
  categoriesSlot: JsonHtml;
}): View<LinkedData> => (linkedData) => {
  const uri = findUrl(linkedData);
  return div(
    { class: "Subhead with-line-length-settings" },
    div({ class: "Subhead-heading" }, String(linkedData.name)),
    ...(uri && isLocalUri(uri)
      ? []
      : [
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
          ),
        ])
  );
};

export const contentHeader: UiComponent<{ renderFields: LinkedData }> = ({
  render,
}) => {
  const [categoriesSlot] = mountComponent(multiSelect({}));

  const containerHeaderView = newContentHeader({
    categoriesSlot,
  });

  return {
    renderFields: link(map(containerHeaderView), render),
  };
};
