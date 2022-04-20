import type { Callback } from "linki";
import { fork, link, map, push, splitDefined, valueWithState } from "linki";
import type { JsonHtml, View } from "linki-ui";
import { button, dangerousHtml, div, h2, mountComponent, span } from "linki-ui";

import type { AnnotationChange } from "../../functions/indexes/annotations-index";
import type { IntervalUri } from "../../libs/calendar-ld";
import type {
  LinkedData,
  LinkedDataWithHashId,
} from "../../libs/jsonld-format";
import { getHash } from "../../libs/linked-data";
import { createDelete } from "../../vocabulary/activity-streams";
import type {
  Annotation,
  AnnotationMotivation,
} from "../annotations/annotation";
import type { AnnotationSaveProps } from "../annotations/service";
import { createAnnotationSaver } from "../annotations/service";
import { moreActions } from "../common/drop-down";
import { editor } from "../common/editor";
import {
  defaultRating,
  ratingForLinkedData,
  ratingProp,
  ratingSelect,
} from "../common/rating";
import { stack } from "../common/spacing";
import type { Uri } from "../common/uri";
import type { PageBlock } from "../system/page";
import { mountBlock } from "../system/page";

const reviewForm: View<{
  intervalUri: Uri;
  onSave: Callback<AnnotationSaveProps>;
}> = ({ intervalUri, onSave }) => {
  const saveData: Callback<string> = link(
    fork(
      link(
        map((content) => ({
          reference: intervalUri,
          content,
          motivation: "assessing" as AnnotationMotivation,
        })),
        onSave
      ),
      () => reset()
    )
  );
  const [editorRoot, { save, reset }] = mountComponent(editor({}), {
    onSave: saveData,
  });
  return div(
    editorRoot,
    div(
      { class: "text-right py-1" },
      button(
        {
          type: "button",
          class: "btn btn-sm btn-primary",
          onClick: () => save(),
        },
        "Add review"
      )
    )
  );
};

export const rating: View<Annotation> = (annotation) =>
  span(
    { class: "ml-2 flex-auto" },
    ratingForLinkedData(annotation as LinkedData)
  );

export const pickFirstAnnotation = (
  op: AnnotationChange
): Annotation | undefined => {
  if (op[0] === "to") {
    if (op[1].length === 0) {
      return undefined;
    } else {
      return op[1][0];
    }
  } else if (op[0] === "set") {
    return op[1];
  } else if (op[0] === "del") {
    return undefined;
  }
};

export const reviewBlock: PageBlock<IntervalUri> = (
  { saveLinkedData, readAppContext, subscribe: { annotations: subscribe } },
  intervalUri
) =>
  mountBlock(({ render }) => {
    const renderAnnotation = link(
      map(
        (annotation: Annotation): JsonHtml =>
          stack(
            { gap: "medium" },
            div(
              { class: "d-flex flex-items-center" },
              h2("Review"),
              rating(annotation),
              moreActions({
                actions: [
                  {
                    label: "Delete",
                    handler: link(
                      push(() =>
                        getHash((annotation as unknown) as LinkedDataWithHashId)
                      ),
                      map(createDelete),
                      saveLinkedData
                    ),
                  },
                ],
              })
            ),
            div(
              {
                class: "Box Box--condensed",
              },
              annotation.body
                ? div(
                    {
                      class: "Box-body",
                    },
                    dangerousHtml(annotation.body!.value)
                  )
                : undefined
            )
          )
      ),
      render
    );

    const [saveWithRating, setRating] = link(
      valueWithState<string, AnnotationSaveProps>(defaultRating),
      map(([rating, props]) =>
        rating
          ? {
              ...props,
              extra: { [ratingProp]: rating },
            }
          : props
      ),
      createAnnotationSaver(readAppContext, saveLinkedData)
    );
    const renderForm = () => {
      setRating(defaultRating);
      render(
        stack(
          { gap: "medium" },
          div(
            { class: "d-flex flex-items-center" },
            h2("Review"),
            span(
              { class: "ml-2 flex-auto" },
              ratingSelect({ onChange: setRating })
            )
          ),
          div(
            reviewForm({
              intervalUri,
              onSave: saveWithRating,
            })
          )
        )
      );
    };

    return {
      stop: link(
        subscribe({ reference: intervalUri, motivation: "assessing" }),
        map(pickFirstAnnotation),
        splitDefined(),
        [renderAnnotation, renderForm]
      ),
    };
  });

const readOnlyView: View<Annotation> = ({ body }) =>
  body
    ? div(
        {
          class: "Box Box--condensed",
        },
        div(
          {
            class: "Box-body",
          },
          dangerousHtml(body.value)
        )
      )
    : undefined;

export const readOnlyReviewBody: PageBlock<IntervalUri> = (
  { subscribe: { annotations: subscribe } },
  intervalUri
) =>
  mountBlock(({ render }) => {
    return {
      stop: link(
        subscribe({
          reference: intervalUri,
          motivation: "assessing",
        }),
        map(pickFirstAnnotation),
        splitDefined(),
        [link(map(readOnlyView), render), () => render(undefined)]
      ),
    };
  });
