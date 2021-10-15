import type { Callback } from "linki";
import { map, passUndefined, link } from "linki";

import type { Component } from "../../libs/simple-ui/render";
import { h2 } from "../../libs/simple-ui/render";
import { blanket } from "../common/blanket";

const getFileItem = (e: DragEvent): DataTransferItem | undefined => {
  if (!e.dataTransfer) {
    console.warn("There was no data transfered");
    return;
  }
  const items = Array.from(e.dataTransfer.items).filter(
    (it) => it.kind === "file"
  );
  if (items.length === 0) {
    console.warn("There was no file attached");
    return;
  }
  if (items.length > 1) {
    console.warn("Only a single file upload is supported");
    return;
  }
  return items[0];
};

export const fileDrop: Component<
  {
    onFile: Callback<File>;
  },
  { handleDragEvent: DragEvent }
> = ({ onFile }) => (render) => {
  const handleFile = (event: DragEvent) => {
    const firstItem = getFileItem(event);
    if (!firstItem) return;

    const file = firstItem.getAsFile();
    if (!file) {
      console.warn("Could not read a file");
      return;
    }
    onFile(file);
  };

  // noinspection JSUnusedGlobalSymbols
  const displayFileDrop = link(
    map(
      passUndefined(() =>
        blanket(
          {
            style: {
              "z-index": "1",
              opacity: "0.6",
              color: "white",
              background: "black",
              "padding-top": "50%",
              "text-align": "center",
            },
          },
          h2("Drop file here"),
          blanket({
            onDragenter: (e) => {
              e.preventDefault();
              e.stopPropagation();
            },
            onDragover: (e) => {
              e.preventDefault();
              e.stopPropagation();
            },
            onDrop: (e) => {
              e.preventDefault();
              displayFileDrop(undefined);
              handleFile(e);
            },
            onDragleave: (e) => {
              e.stopPropagation();
              e.preventDefault();
              displayFileDrop(undefined);
            },
          })
        )
      )
    ),
    render
  );
  return {
    handleDragEvent: link(
      map((event): true | undefined => (getFileItem(event) ? true : undefined)),
      displayFileDrop
    ),
  };
};
