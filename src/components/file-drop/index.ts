import { map, Callback, passUndefined, link } from "linki";

import { Component, h2 } from "../../libs/simple-ui/render";
import { blanket } from "../common/blanket";

export const fileDrop: Component<
  {
    onFile: Callback<File>;
  },
  { displayFileDrop: true | undefined }
> = ({ onFile }) => (render) => {
  const handleFile = (e: DragEvent) => {
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
    const firstItem = items[0];
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
  return { displayFileDrop };
};
