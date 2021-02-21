import { combineLatest, Provider, wrap } from "../../libs/connections";
import { map } from "../../libs/connections/processors2";
import { button, Component, div, View } from "../../libs/simple-ui/render";

export type Selection = {
  text: string;
  x: number;
  y: number;
};

export const currentSelection = (): Selection | undefined => {
  const selection = window.getSelection();
  if (!selection || selection.type !== "Range") return;
  const range = selection.getRangeAt(0);
  if (!range) return;

  const { x, y, width } = range.getBoundingClientRect();
  const text = range.toString().trim();
  return { text, x: x + width / 2, y };
};

export const selectionToolbarView: View<{ left: number; top: number }> = ({
  left,
  top,
}) =>
  div(
    {
      class: "Popover",
      style: { left, top, transform: "translate(-50%, -125%)" },
    },
    div(
      {
        class:
          "Popover-message Popover-message--bottom width-auto BtnGroup box-shadow-large",
      },
      button(
        {
          class: `BtnGroup-item btn btn-sm`,
          type: "button",
          onClick: () => {},
        },
        "add comment"
      )
    )
  );

export const selectionToolbar: Component<{
  selectionProvider: Provider<Selection | undefined>;
  contentElementProvider: Provider<HTMLElement>;
}> = ({ selectionProvider, contentElementProvider }) => (render) => {
  const combine = combineLatest(
    { selection: undefined as undefined | Selection },
    { contentElement: undefined as undefined | HTMLElement }
  )(
    map(({ selection, contentElement }) => {
      if (!selection || !contentElement) {
        return undefined;
      }
      const { x, y } = contentElement.getBoundingClientRect();
      const left = selection.x - x;
      const top = selection.y - y;
      return selectionToolbarView({ left, top });
    }, render)
  );

  selectionProvider(map(wrap("selection")(), combine));
  contentElementProvider(map(wrap("contentElement")(), combine));
};
