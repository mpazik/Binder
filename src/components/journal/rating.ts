import type { Callback } from "linki";
import { link, map } from "linki";
import type { JsonHtml, View } from "linki-ui";
import { getTargetInputValue, option, select, span } from "linki-ui";

import type { LinkedData } from "../../libs/jsonld-format";

export const ratingProp = "http://schema.org/Rating";
const ratingMap: Record<string, string> = {
  "0.5": "🌗🌑🌑🌑🌑",
  "1": "🌕🌑🌑🌑🌑",
  "1.5": "🌕🌗🌑🌑🌑",
  "2": "🌕🌕🌑🌑🌑",
  "2.5": "🌕🌕🌗🌑🌑",
  "3": "🌕🌕🌕️🌑🌑",
  "3.5": "🌕🌕🌕️🌗🌑",
  "4": "🌕🌕🌕️🌕️🌑",
  "4.5": "🌕🌕🌕️🌕️🌗",
  "5": "🌕🌕🌕️🌕️🌕️",
};

const ratingValues = Object.keys(ratingMap);

const ratingOption = (value: string) => option({ value }, ratingMap[value]);
const ratingValuesForDisplay = Object.keys(ratingMap).sort().reverse();
export const defaultRating = ratingValuesForDisplay[0];
export const ratingSelect: View<{ onChange: Callback<string> }> = ({
  onChange,
}) => {
  return select(
    {
      class: "f3",
      style: { border: "none" },
      onChange: link(map(getTargetInputValue), onChange),
    },
    ...ratingValuesForDisplay.map(ratingOption)
  );
};
const rating = (value: string) => span({ class: "f3" }, ratingMap[value]);

export const ratingForLinkedData = (ld: LinkedData): JsonHtml => {
  return ld[ratingProp] &&
    typeof ld[ratingProp] === "string" &&
    ratingValues.includes(ld[ratingProp] as string)
    ? rating(ld[ratingProp] as string)
    : undefined;
};
