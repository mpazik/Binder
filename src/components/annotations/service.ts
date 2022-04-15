import type { Callback } from "linki";
import { cast, link, map, nonNull } from "linki";

import type { AppContextProvider } from "../../functions/app-context";
import type {
  AnnotationsIndex,
  AnnotationsQuery,
} from "../../functions/indexes/annotations-index";
import type { LinkedDataStoreRead } from "../../functions/store/local-store";
import type { LinkedData } from "../../libs/jsonld-format";
import type { Uri } from "../common/uri";

import type {
  Annotation,
  AnnotationMotivation,
  AnnotationSelector,
} from "./annotation";
import { createAnnotation } from "./annotation";

export type AnnotationsFetcher = (
  query: AnnotationsQuery
) => Promise<Annotation[]>;

export const createAnnotationFetcher = ({
  ldStoreRead,
  annotationsIndex,
}: {
  ldStoreRead: LinkedDataStoreRead;
  annotationsIndex: AnnotationsIndex["search"];
}): AnnotationsFetcher => {
  return async (query) => {
    const hashUris = await annotationsIndex(query);
    const result = await Promise.all(
      hashUris
        .flatMap(({ props }) => props)
        .map((hashUri) => ldStoreRead(hashUri))
    );
    return result.filter(nonNull).map(cast());
  };
};

export type AnnotationSaveProps = {
  reference: Uri;
  motivation?: AnnotationMotivation;
  extra?: Record<string, unknown>;
  content?: string;
  selector?: AnnotationSelector;
};

export const createAnnotationSaver = (
  getContext: AppContextProvider,
  saveLinkedData: Callback<LinkedData>
): Callback<AnnotationSaveProps> =>
  link(
    map((props) => {
      const creator = getContext("user");
      return ({
        ...props.extra,
        ...createAnnotation(
          props.reference,
          props.selector,
          props.content,
          creator ?? undefined,
          props.motivation
        ),
      } as unknown) as LinkedData;
    }),
    saveLinkedData
  );
