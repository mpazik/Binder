export type QuoteSelector = {
  type: "TextQuoteSelector";
  exact: string;
  prefix?: string;
  suffix?: string;
};

export type TextualBody = {
  type: "TextualBody";
  value: string;
  format: "text/html";
};

export type Annotation = {
  "@context": "http://www.w3.org/ns/anno.jsonld";
  type: "Annotation";
  created: string;
  creator?: string;
  motivation?: "commenting" | "highlighting";
  body?: TextualBody;
  target: {
    source: string;
    selector: QuoteSelector;
  };
};

export type AnnotationCore = { selector: QuoteSelector; content?: string };

export const createAnnotation = (
  source: string,
  selector: QuoteSelector,
  htmlBody?: string,
  creator?: string
): Annotation => ({
  "@context": "http://www.w3.org/ns/anno.jsonld",
  type: "Annotation",
  created: new Date().toISOString(),
  ...(creator ? { creator: "mailto:" + creator } : {}),
  motivation: htmlBody ? "commenting" : "highlighting",
  ...(htmlBody
    ? {
        body: {
          type: "TextualBody",
          value: htmlBody,
          format: "text/html",
        },
      }
    : {}),
  target: {
    source,
    selector,
  },
});
