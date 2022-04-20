import type { JsonHtml, View } from "linki-ui";
import { a, div, mountComponent, span } from "linki-ui";

import { CATEGORIES_ENABLED } from "../../../config";
import type { LinkedData } from "../../../libs/jsonld-format";
import { findUrl } from "../../../libs/linked-data";
import { multiSelect } from "../../common/multi-select";
import { isLocalUri } from "../../common/uri";
import type { PageBlock } from "../../system/page";

const newContentHeader: View<{
  linkedData: LinkedData;
  categoriesSlot: JsonHtml;
}> = ({ categoriesSlot, linkedData }) => {
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

export const contentHeader: PageBlock<LinkedData> = (controls, linkedData) =>
  newContentHeader({
    categoriesSlot: mountComponent(multiSelect({}))[0][0],
    linkedData,
  });
