import { link, map, splitDefined } from "linki";

import type { IntervalUri } from "../../libs/calendar-ld";
import type { PageBlock } from "../system/page";
import { mountBlock } from "../system/page";

import { pickFirstAnnotation, rating } from "./review";

export const readOnlyReviewRating: PageBlock<IntervalUri> = (
  { subscribe: { annotations: subscribe } },
  intervalUri
) =>
  mountBlock(
    ({ render }) => {
      return {
        stop: link(
          subscribe({
            reference: intervalUri,
            motivation: "assessing",
          }),
          map(pickFirstAnnotation),
          splitDefined(),
          [link(map(rating), render), () => render(undefined)]
        ),
      };
    },
    { parentTag: "span" }
  );
