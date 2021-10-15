import type * as JSZip from "jszip";

import { throwIfNull } from "./errors";

const domParser = new DOMParser();

export type ZipObject = ReturnType<JSZip>;

export const getBlobFile = (
  zip: ZipObject,
  fileName: string
): Promise<Blob> => {
  const file = zip.file(fileName);
  if (!file) {
    return Promise.reject(
      `file "${fileName}" is not defined in the zip archive "${zip.name}"`
    );
  }
  return throwIfNull(file).async("blob");
};

export const getXmlFile = (
  zip: ZipObject,
  fileName: string
): Promise<Document> =>
  zip
    .file(fileName)!
    .async("string")
    .then((data) => domParser.parseFromString(data, "application/xml"));
