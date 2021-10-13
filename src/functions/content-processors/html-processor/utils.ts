import { htmlMediaType } from "../../../libs/ld-schemas";

const serializeDocument = (contentDocument: Document) => {
  const serializer = new XMLSerializer();
  return "<!DOCTYPE html>\n" + serializer.serializeToString(contentDocument);
};

export const documentToBlob = (content: Document): Blob =>
  new Blob([serializeDocument(content)], {
    type: htmlMediaType,
  });

export const blobToDocument = async (content: Blob): Promise<Document> => {
  const text = await content.text();
  const domParser = new DOMParser();
  return domParser.parseFromString(text, htmlMediaType);
};

export const createDocument = ({
  title,
  contentRoot,
  url,
}: {
  title: string;
  contentRoot: Node;
  url?: string;
}): Document => {
  const contentDocument = document.implementation.createHTMLDocument(title);
  // const bodyElement = contentDocument.createElement("body");
  // bodyElement.appendChild(contentElement);
  contentDocument.body.appendChild(contentRoot);

  const metaEl = contentDocument.createElement("meta");
  metaEl.setAttribute("charset", "UTF-8");
  contentDocument.head.appendChild(metaEl);

  if (url) {
    const baseEl = contentDocument.createElement("base");
    baseEl.setAttribute("href", url);
    contentDocument.head.appendChild(baseEl);
  }
  return contentDocument;
};
