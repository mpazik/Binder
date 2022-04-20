import type { Callback } from "linki";
import { fork, head, link, map } from "linki";
import type { UiItemComponent, View } from "linki-ui";
import {
  button,
  dangerousHtml,
  div,
  h2,
  mountComponent,
  mountItemComponent,
  renderJsonHtmlToDom,
  span,
} from "linki-ui";

import type { IntervalUri } from "../../libs/calendar-ld";
import type { LinkedDataWithHashId } from "../../libs/jsonld-format";
import { getHash } from "../../libs/linked-data";
import { formatDateTime } from "../../libs/time";
import { createDelete } from "../../vocabulary/activity-streams";
import type { Annotation } from "../annotations/annotation";
import type { AnnotationSaveProps } from "../annotations/service";
import { createAnnotationSaver } from "../annotations/service";
import { moreActions } from "../common/drop-down";
import { editor } from "../common/editor";
import { stack } from "../common/spacing";
import type { Uri } from "../common/uri";
import type { PageBlock } from "../system/page";
import { mountBlock } from "../system/page";

const dateTimeOfAction: View<{ date: Date; action: string }> = ({
  date,
  action,
}) =>
  span({ class: "color-text-secondary" }, action, " on ", formatDateTime(date));

const createCommentView = (onDelete: () => void): View<Annotation> => (
  annotation
) =>
  div(
    {
      class: "Box Box--condensed",
    },
    div(
      { class: "Box-header d-flex flex-items-center" },
      span(
        { class: "flex-auto" },
        dateTimeOfAction({
          date: new Date(annotation.created),
          action: "commented",
        })
      ),
      moreActions({
        actions: [
          {
            label: "Delete",
            handler: () => onDelete(),
          },
        ],
      })
    ),
    annotation.body
      ? div(
          {
            class: "Box-body p-2 pb-0",
          },
          dangerousHtml(annotation.body!.value)
        )
      : undefined
  );

const commentComponent: UiItemComponent<Annotation, { onDelete: void }> = ({
  render,
  onDelete,
}) => {
  return {
    updateItem: link(map(createCommentView(onDelete)), render),
  };
};

const commentForm: View<{
  intervalUri: Uri;
  onSave: Callback<AnnotationSaveProps>;
}> = ({ intervalUri, onSave }) => {
  const saveData: Callback<string> = link(
    fork(
      link(
        map((content) => ({
          reference: intervalUri,
          content,
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
        "Add comment"
      )
    )
  );
};

const getId = (it: Annotation) =>
  getHash((it as unknown) as LinkedDataWithHashId);

export const commentsBlock: PageBlock<IntervalUri> = (
  { readAppContext, saveLinkedData, subscribe: { annotations: subscribe } },
  intervalUri
) =>
  mountBlock(({ render }) => {
    const [commentsSlot, { changeItems: changeComments }] = mountItemComponent(
      getId,
      commentComponent,
      { onDelete: link(map(head(), createDelete), saveLinkedData) },
      { parent: renderJsonHtmlToDom(stack()) as HTMLElement }
    );

    render(
      stack(
        { gap: "medium" },
        div(h2("Comments"), commentsSlot),
        div(
          commentForm({
            intervalUri,
            onSave: createAnnotationSaver(readAppContext, saveLinkedData),
          })
        )
      )
    );
    return {
      stop: link(
        subscribe({ reference: intervalUri, motivation: "commenting" }),
        changeComments
      ),
    };
  });
