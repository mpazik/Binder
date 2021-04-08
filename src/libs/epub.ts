import * as JSZip from "jszip";

const domParser = new DOMParser();

export type ZipObject = ReturnType<JSZip>;

export const getBlobFile = (zip: ZipObject, fileName: string): Promise<Blob> =>
  zip.file(fileName)!.async("blob");

export const getXmlFile = (
  zip: ZipObject,
  fileName: string
): Promise<Document> =>
  zip
    .file(fileName)!
    .async("string")
    .then((data) => domParser.parseFromString(data, "application/xml"));
