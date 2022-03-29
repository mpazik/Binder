import type { JsonHtml } from "linki-ui";

import type { LinkedData } from "../../../libs/jsonld-format";

import { ratingForLinkedData, ratingProp, ratingSelect } from "./index";

export default {};

export const ratingSelectExample = (): JsonHtml =>
  ratingSelect({ onChange: alert });

export const ratingForLinkedDataExample = (): JsonHtml =>
  ratingForLinkedData({ [ratingProp]: "4.5" } as LinkedData);
