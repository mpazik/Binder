import type { Callback } from "linki";
import { and, filter, fork, link, map, not, passOnlyChanged } from "linki";
import type { UiComponent, View } from "linki-ui";
import { button, div, hasNoKeyModifier, isKey } from "linki-ui";

import { keyNameTooltip } from "../../libs/key-events";

import type { OptSelection, Position, Selection } from "./selection";
import { selectionExists, selectionPosition } from "./selection";

export type Button = {
  handler: (selection: Selection) => void;
  label: string;
  shortCutKey?: string;
};

type InternalButton = {
  handler: () => void;
  label: string;
  shortCutKey?: string;
};

export const selectionToolbarView: View<{
  position: Position;
  buttons: InternalButton[];
}> = ({ position: [left, top], buttons }) =>
  div(
    {
      class: "Popover",
      style: {
        left: `${left}px`,
        top: `${top}px`,
        transform: "translate(-50%, -125%)",
      },
    },
    div(
      {
        class:
          "Popover-message Popover-message--bottom BtnGroup color-shadow-large width-auto d-flex",
      },
      ...buttons.map(({ handler, label, shortCutKey }) =>
        button(
          {
            class: `BtnGroup-item btn btn-sm`,
            type: "button",
            title: shortCutKey
              ? `${label}    ${keyNameTooltip(shortCutKey)}`
              : undefined,
            onClick: () => handler(),
          },
          label
        )
      )
    )
  );

export const selectionToolbar = ({
  buttons,
}: {
  buttons: Button[];
}): UiComponent<{ selectionHandler: OptSelection }> => ({ render }) => {
  const renderState = link(
    map((selection: OptSelection) => {
      if (!selection) return;
      return selectionToolbarView({
        position: selectionPosition(selection),
        buttons: buttons.map(({ handler, ...rest }) => ({
          handler: () => {
            handler(selection);
            selectionHandler(undefined);
          },
          ...rest,
        })),
      });
    }),
    render
  );

  let lastButtonHandlers: ((e: KeyboardEvent) => void)[] = [];

  const registerButtonHandler = (selection: OptSelection) => {
    lastButtonHandlers.forEach((handler) =>
      document.removeEventListener("keydown", handler)
    );
    lastButtonHandlers = [];

    if (selection) {
      lastButtonHandlers = buttons
        .filter((it) => Boolean(it.shortCutKey))
        .map(({ shortCutKey, handler }) =>
          link(
            filter(and(isKey(shortCutKey!), hasNoKeyModifier)),
            fork(
              () => handler(selection),
              () => selectionHandler(undefined)
            )
          )
        );
      lastButtonHandlers.forEach((handler) =>
        document.addEventListener("keydown", handler)
      );
    }
  };

  const selectionHandler: Callback<OptSelection> = link(
    passOnlyChanged(),
    fork(renderState, registerButtonHandler)
  );
  const mouseUpHandler = link(filter(not(selectionExists)), () =>
    selectionHandler(undefined)
  );
  document.addEventListener("mouseup", mouseUpHandler);
  return {
    stop: () => document.removeEventListener("mouseup", mouseUpHandler),
    selectionHandler,
  };
};
