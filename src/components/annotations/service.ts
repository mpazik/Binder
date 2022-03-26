import type { Callback, Component } from "linki";
import { cast, link, map, nonNull, valueWithState } from "linki";

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

export type AnnotationsSaver = Callback<AnnotationSaveProps>;

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

export const createAnnotationSaverWithContext: Component<
  {
    saveAnnotation: AnnotationSaveProps;
    setCreator: string | undefined;
  },
  { saveLinkedData: LinkedData }
> = ({ saveLinkedData }) => {
  const [saveAnnotationInt, setCreator]: [
    Callback<AnnotationSaveProps>,
    Callback<string | undefined>
  ] = link(
    valueWithState<string | undefined, AnnotationSaveProps>(undefined),
    map(([creator, params]) => {
      const annotation = createAnnotation(
        params.reference,
        params.selector,
        params.content,
        creator ?? undefined,
        params.motivation
      );
      return ({
        ...params.extra,
        ...annotation,
      } as unknown) as LinkedData;
    }),
    saveLinkedData
  );

  return {
    saveAnnotation: saveAnnotationInt,
    setCreator,
  };
};
