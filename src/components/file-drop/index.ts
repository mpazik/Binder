import { Callback } from "../../libs/connections";
import { map, passUndefined } from "../../libs/connections/mappers";
import { Component, h2 } from "../../libs/simple-ui/render";
import { blanket } from "../common/blanket";

export const fileDrop: Component<
  {
    onFile: Callback<Blob>;
  },
  { displayFileDrop: true | undefined }
> = ({ onFile }) => (render) => {
  const handleFile = (e: DragEvent) => {
    if (!e.dataTransfer || e.dataTransfer.items.length === 0) {
      console.warn("There was no file attached");
      return;
    }
    if (e.dataTransfer.items.length > 1) {
      console.warn("Only a single file upload is supported");
      return;
    }
    const firstItem = e.dataTransfer.items[0];

    if (firstItem.kind !== "file") {
      console.warn("Item is not a file");
      return;
    }
    const file = firstItem.getAsFile();
    if (!file) {
      console.warn("Could not read a file");
      return;
    }
    if (file.type !== "text/html") {
      console.warn(`File type '${file.type}' is not supported`);
      return;
    }
    onFile(file);
  };

  // noinspection JSUnusedGlobalSymbols
  const displayFileDrop = map(
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
    ),
    render
  );
  return { displayFileDrop };
};
