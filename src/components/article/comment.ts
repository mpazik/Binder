import { Provider } from "../../libs/connections";
import {
  closableMap,
  delayedState,
  statefulMap,
} from "../../libs/connections/processors2";
import { button, Component, div, View } from "../../libs/simple-ui/render";

import {
  Annotation,
  getSelectorPosition,
  quoteSelectorForSelection,
  renderTemporarySelector,
} from "./highlights";
import { rangePositionRelative } from "./selection-toolbar";

export type ContainerContext = {
  container: HTMLElement;
  text: string;
};

export type WithContainerContext<T> = {
  container: HTMLElement;
  text: string;
  data: T;
};

const commentView: View<{
  top: number;
  left: number;
  content: string;
  onHover: () => void;
  onHoverOut: () => void;
}> = ({ top, left, content, onHover, onHoverOut }) =>
  div(
    {
      class: "Box Popover",
      style: {
        left,
        top,
        transform: "translate(-50%, 0)",
        "min-height": "80px",
        width: "200px",
      },
      onMouseleave: onHoverOut,
      onMouseenter: onHover,
    },
    div({
      class: "Box-body p-1",
      style: {},
      dangerouslySetInnerHTML: content,
    })
  );

export const commentDisplay: Component<{
  commentProvider: Provider<WithContainerContext<Annotation> | undefined>;
}> = ({ commentProvider }) => (render) => {
  const renderPopup = closableMap(
    (data: WithContainerContext<Annotation> | undefined) => {
      if (!data) {
        return;
      }
      const { container, text, data: annotation } = data;
      const { left, top } = getSelectorPosition(
        container,
        text,
        annotation.target.selector
      );
      return commentView({
        top,
        left,
        content: "test",
        onHover: () => {
          handleData(data);
        },
        onHoverOut: () => {
          handleData(undefined);
        },
      });
    },
    render
  );
  const handleData = delayedState(undefined, 300, renderPopup);
  commentProvider(handleData);
};

const commentFormView: View<{
  top: number;
  left: number;
  onDisplay: (editor: HTMLElement) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ top, left, onSave, onCancel, onDisplay }) =>
  div(
    {
      class: "Box Popover",
      style: { left, top, transform: "translate(-50%, 20px)" },
    },
    div(
      { class: "Box-body p-1" },
      div({
        class: "form-control p-1",
        style: { "min-height": "80px", width: "200px" },
        contenteditable: true,
        onDisplay: (event) => {
          const target = event.target as HTMLElement;
          target.focus();
          onDisplay(target);
        },
      })
    ),
    div(
      { class: "Box-footer text-right p-1" },
      button(
        {
          type: "button",
          class: "btn btn-sm btn-secondary mr-1",
          onClick: onCancel,
        },
        "Cancel"
      ),
      button(
        { type: "button", class: "btn btn-sm btn-primary", onClick: onSave },
        "Save"
      )
    )
  );

export const commentForm: Component<{
  commentFormProvider: Provider<WithContainerContext<Range>>;
}> = ({ commentFormProvider }) => (render) => {
  const [mapWithEditor, setEditor, resetEditor] = statefulMap<HTMLElement>();

  const renderForm = closableMap(
    (data: WithContainerContext<Range> | undefined, onClose) => {
      if (!data) {
        resetEditor();
        return;
      }
      const { container, text, data: range } = data;
      const [remove] = renderTemporarySelector(
        container,
        text,
        quoteSelectorForSelection(container, text, range)
      );
      onClose(remove);

      const [left, top] = rangePositionRelative(range, container);
      return commentFormView({
        top,
        left,
        onDisplay: setEditor,
        onCancel: () => {
          renderForm(undefined);
        },
        onSave: mapWithEditor<void, HTMLElement>(
          (_, editor) => editor,
          (editor) => {
            console.log(editor.innerHTML);
          }
        ),
      });
    },
    render
  );

  commentFormProvider(renderForm);
};
