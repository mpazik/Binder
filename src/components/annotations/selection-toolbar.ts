import { fork, passOnlyChanged } from "../../libs/connections";
import { and, filter, not } from "../../libs/connections/filters";
import { map, mapTo } from "../../libs/connections/mappers";
import { button, Component, div, View } from "../../libs/simple-ui/render";
import { hasNoKeyModifier, isKey } from "../../libs/simple-ui/utils/funtions";

import {
  OptSelection,
  Position,
  Selection,
  selectionExists,
  selectionPosition,
} from "./selection";

export type Button = {
  handler: (selection: Selection) => void;
  label: string;
  shortCutKey?: string;
};

const keyCodeToKeyName = (keyCode: string) => {
  if (keyCode.startsWith("Key")) {
    return keyCode.substring(3);
  }
  return keyCode;
};

export const selectionToolbarView: View<{
  position: Position;
  buttons: Button[];
}> = ({ position: [left, top], buttons }) =>
  div(
    {
      class: "Popover",
      style: { left, top, transform: "translate(-50%, -125%)" },
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
              ? `${label}    [${keyCodeToKeyName(shortCutKey)}]`
              : undefined,
            onClick: handler,
          },
          label
        )
      )
    )
  );

export const selectionToolbar: Component<
  {
    buttons: Button[];
  },
  { selectionHandler: OptSelection }
> = ({ buttons }) => (render, onClose) => {
  const renderState = map((selection: OptSelection) => {
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
  }, render);

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
          filter(
            and(isKey(shortCutKey!), hasNoKeyModifier),
            fork(() => handler(selection), mapTo(undefined, selectionHandler))
          )
        );
      lastButtonHandlers.forEach((handler) =>
        document.addEventListener("keydown", handler)
      );
    }
  };

  const selectionHandler = passOnlyChanged(
    fork(renderState, registerButtonHandler)
  );
  const mouseUpHandler = filter(
    not(selectionExists),
    mapTo(undefined, selectionHandler)
  );
  document.addEventListener("mouseup", mouseUpHandler);
  onClose(() => {
    document.removeEventListener("mouseup", mouseUpHandler);
  });

  return {
    selectionHandler,
  };
};
