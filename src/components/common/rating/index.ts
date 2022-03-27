import type { Callback } from "linki";
import { link, map } from "linki";
import type { JsonHtml, View } from "linki-ui";
import { getTargetInputValue, option, select, span } from "linki-ui";

import type { LinkedData } from "../../../libs/jsonld-format";

export const ratingProp = "http://schema.org/Rating";
type RatingMap = Record<string, string>;
const ratingMap: RatingMap = {
  "1": "⭐",
  "2": "⭐⭐",
  "3": "⭐⭐⭐",
  "4": "⭐⭐⭐⭐",
  "5": "⭐⭐⭐⭐⭐",
};
const ratingReadMap: RatingMap = {
  "1": "⭐",
  "1.5": "⭐",
  "2": "⭐⭐",
  "2.5": "⭐⭐",
  "3": "⭐⭐⭐",
  "3.5": "⭐⭐⭐",
  "4": "⭐⭐⭐⭐",
  "4.5": "⭐⭐⭐⭐",
  "5": "⭐⭐⭐⭐⭐",
  "5.5": "⭐⭐⭐⭐⭐",
};
const ratingMapWithHalves: RatingMap = {
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

const ratingOptionFactory = (ratingMap: RatingMap): View<string> => (value) =>
  option({ value }, ratingMap[value]);

export const defaultRating = Object.keys(ratingMap).sort().reverse()[0];

export const ratingSelectFactory = (
  ratingMap: RatingMap
): View<{
  onChange: Callback<string>;
}> => {
  const valueForDisplay = Object.keys(ratingMap).sort().reverse();
  const ratingOption = ratingOptionFactory(ratingMap);
  return ({ onChange }) =>
    select(
      {
        class: "f3",
        style: { border: "none" },
        onChange: link(map(getTargetInputValue), onChange),
      },
      ...valueForDisplay.map(ratingOption)
    );
};

export const ratingSelect = ratingSelectFactory(ratingMap);
export const ratingSelectWithHalves = ratingSelectFactory(ratingMapWithHalves);

const ratingFactory = (ratingMap: RatingMap): View<string> => (value) =>
  span({ class: "f3" }, ratingMap[value]);

const ratingForLinkedDataFactory = (ratingMap: RatingMap) => (
  ld: LinkedData
): JsonHtml => {
  const rating = ratingFactory(ratingMap);
  return ld[ratingProp] &&
    typeof ld[ratingProp] === "string" &&
    Object.keys(ratingMap).includes(ld[ratingProp] as string)
    ? rating(ld[ratingProp] as string)
    : undefined;
};

export const ratingForLinkedData = ratingForLinkedDataFactory(ratingReadMap);
export const ratingWithHalvesForLinkedData = ratingForLinkedDataFactory(
  ratingMapWithHalves
);
