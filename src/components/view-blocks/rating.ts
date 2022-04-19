import { link, map, splitDefined } from "linki";

import type { IntervalUri } from "../../libs/calendar-ld";

import { pickFirstAnnotation, rating } from "./review";
import type { PageBlock } from "./utils";
import { mountBlock } from "./utils";

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
