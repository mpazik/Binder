import type { EditorState } from "prosemirror-state";
import { Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import "./style.css";

export const selectionSizePlugin = new Plugin({
  view(view) {
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    view.dom.parentNode!.appendChild(tooltip);
    const updateTooltip = (view: EditorView, lastState?: EditorState) => {
      const state = view.state;
      // Don't do anything if the document/selection didn't change
      if (
        lastState &&
        lastState.doc.eq(state.doc) &&
        lastState.selection.eq(state.selection)
      )
        return;

      // Hide the tooltip if the selection is empty
      if (state.selection.empty) {
        tooltip.style.display = "none";
        return;
      }

      // Otherwise, reposition it and update its content
      tooltip.style.display = "block";
      const { from, to } = state.selection;
      // These are in screen coordinates
      const start = view.coordsAtPos(from),
        end = view.coordsAtPos(to);
      // The box in which the tooltip is positioned, to use as base
      const box = tooltip.offsetParent!.getBoundingClientRect();
      // Find a center-ish x position from the selection endpoints (when
      // crossing lines, end may be more to the left)
      const left = Math.max((start.left + end.left) / 2, start.left + 3);
      tooltip.style.left = left - box.left + "px";
      tooltip.style.bottom = box.bottom - start.top + "px";
      tooltip.textContent = to - from + "";
    };

    updateTooltip(view);

    return {
      update: updateTooltip,
      destroy: () => {
        tooltip.remove();
      },
    };
  },
});
