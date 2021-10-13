import { epubContentProcessor } from "./epub-processor";
import { htmlContentProcessor } from "./html-processor";
import { pdfContentProcessor } from "./pdf-processor";
import type { ContentProcessor, LinkedDataWithContent } from "./types";
import { getNameFromUrl } from "./utils";

export type {
  LinkedDataWithContent,
  SavedLinkedDataWithContent,
} from "./types";

const contentProcessors: ContentProcessor[] = [
  htmlContentProcessor,
  pdfContentProcessor,
  epubContentProcessor,
];

const findProcessor = (contentType: string): ContentProcessor | undefined =>
  contentProcessors.find(({ mediaType }) =>
    Array.isArray(mediaType)
      ? mediaType.includes(contentType)
      : mediaType === contentType
  );

export const processResponseToContent = async (
  response: Response,
  url: string
): Promise<LinkedDataWithContent> => {
  if (response.status >= 300) {
    throw new Error(`Invalid response "${response.status}" from "${url}"`);
  }
  const header = response.headers.get("content-type");
  if (!header) {
    throw new Error(`Response content type was not specified`);
  }
  const contentType = header.split(";")[0];
  const processor = findProcessor(contentType);
  if (!processor)
    throw new Error(`Content type "${contentType}" not supported`);

  return processor.process(await response.blob(), {
    name: getNameFromUrl(url),
    url,
  });
};

export const processFileToContent = async (
  file: File
): Promise<LinkedDataWithContent> => {
  const contentType = file.type;
  const processor = findProcessor(contentType);
  if (!processor)
    throw new Error(`Content type "${contentType}" not supported`);

  // todo we be good to do a reverse search here for a linked data to the file hash
  return processor.process(file, {
    name: file.name,
    createTime: new Date(file.lastModified).toISOString(),
  });
};
