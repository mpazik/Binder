import type { Callback, Component, Processor } from "linki";
import {
  asyncMapWithErrorHandler,
  cast,
  defined,
  filter,
  link,
  map,
  nonNull,
  valueWithState,
} from "linki";

import type {
  AnnotationsIndex,
  AnnotationsQuery,
} from "../../functions/indexes/annotations-index";
import type { LinkedDataStoreRead } from "../../functions/store/local-store";
import type { Uri } from "../common/uri";

import type { Annotation, AnnotationSelector } from "./annotation";
import { createAnnotation } from "./annotation";

export type AnnotationsFetcher = (
  query: AnnotationsQuery
) => Promise<Annotation[]>;

export type AnnotationsFeeder = Processor<AnnotationsQuery, Annotation>;

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

export const createAnnotationFeeder = ({
  ldStoreRead,
  subscribe,
}: {
  ldStoreRead: LinkedDataStoreRead;
  subscribe: AnnotationsIndex["subscribe"];
}): AnnotationsFeeder => (callback) =>
  link(
    subscribe,
    asyncMapWithErrorHandler(ldStoreRead, (error) => console.error(error)),
    filter(defined),
    cast(),
    callback
  );

export type AnnotationSaveProps = { reference: Uri } & (
  | {
      selector: AnnotationSelector;
      content?: string;
    }
  | {
      content: string;
      selector: undefined;
    }
);

export const createAnnotationSaverWithContext: Component<
  {
    saveAnnotation: AnnotationSaveProps;
    setCreator: string | undefined;
  },
  { saveAnnotation: Annotation }
> = ({ saveAnnotation }) => {
  const [saveAnnotationInt, setCreator]: [
    Callback<AnnotationSaveProps>,
    Callback<string | undefined>
  ] = link(
    valueWithState<string | undefined, AnnotationSaveProps>(undefined),
    map(
      ([creator, params]): Annotation =>
        createAnnotation(
          params.reference,
          params.selector,
          params.content,
          creator ?? undefined
        )
    ),
    saveAnnotation
  );

  return {
    saveAnnotation: saveAnnotationInt,
    setCreator,
  };
};
