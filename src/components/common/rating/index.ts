import type { Callback } from "linki";
import { link, map } from "linki";
import type { View } from "linki-ui";
import { getTargetInputValue, option, select, span } from "linki-ui";

import type { HashUri } from "../../../libs/hash";
import type { LinkedData } from "../../../libs/jsonld-format";

export const ratingProp = "http://schema.org/Rating";
type RatingLinkedData = {
  "@context": "https://schema.org";
  "@type": "Rating";
  bestRating: "5";
  ratingValue: string;
  worstRating: "1";
};
const linkedDataRatings: Record<string, RatingLinkedData> = {
  "nih:sha-256;ea4c6ff58a6ab99b183fbf665df13ecb63fb3a5b8c9bc3e5b08173eb2bcde8": {
    "@context": "https://schema.org",
    "@type": "Rating",
    bestRating: "5",
    ratingValue: "5",
    worstRating: "1",
  },
  "nih:sha-256;fe3c90f2b93a58afa37cd996e99e017895e0e4371d36e3f80b12229d75bca521": {
    "@context": "https://schema.org",
    "@type": "Rating",
    bestRating: "5",
    ratingValue: "4",
    worstRating: "1",
  },
  "nih:sha-256;a23e2f5099e2d0dff18218a32d4942fc24a769493c3128d51463b5e3beab78f6": {
    "@context": "https://schema.org",
    "@type": "Rating",
    bestRating: "5",
    ratingValue: "3",
    worstRating: "1",
  },
  "nih:sha-256;52c124774533dbf9f9f94610c0349a6f54e8c153f043dc6ac23c76d3bcbe24d2": {
    "@context": "https://schema.org",
    "@type": "Rating",
    bestRating: "5",
    ratingValue: "2",
    worstRating: "1",
  },
  "nih:sha-256;69025030b49ffb6f8cebca77128d46b63af96b602cbae542099ecb061fbc6c3b": {
    "@context": "https://schema.org",
    "@type": "Rating",
    bestRating: "5",
    ratingValue: "1",
    worstRating: "1",
  },
};
type RatingMap = Record<string, string>;
const ratingMap: RatingMap = {
  "1": "⭐",
  "2": "⭐⭐",
  "3": "⭐⭐⭐",
  "4": "⭐⭐⭐⭐",
  "5": "⭐⭐⭐⭐⭐",
};

const ratingOption: View<string> = (value) =>
  option({ value }, ratingMap[linkedDataRatings[value].ratingValue]);

export const defaultRating = Object.keys(linkedDataRatings)[0];
export const ratingSelect: View<{
  onChange: Callback<string>;
}> = ({ onChange }) =>
  select(
    {
      class: "f3",
      style: { border: "none" },
      onChange: link(map(getTargetInputValue), onChange),
    },
    ...Object.keys(linkedDataRatings).map(ratingOption)
  );

const rating: View<string> = (value) => span({ class: "f3" }, ratingMap[value]);

export const ratingForLinkedData: View<LinkedData> = (ld) =>
  ld[ratingProp] &&
  typeof ld[ratingProp] === "string" &&
  Object.keys(linkedDataRatings).includes(ld[ratingProp] as string)
    ? rating(linkedDataRatings[ld[ratingProp] as HashUri].ratingValue)
    : undefined;
