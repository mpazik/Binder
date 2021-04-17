export type QuoteSelector = {
  type: "TextQuoteSelector";
  exact: string;
  prefix?: string;
  suffix?: string;
};

// Fragment specification comes from https://www.w3.org/TR/annotation-model/#fragment-selector
export const HtmlFragmentSpec = "http://tools.ietf.org/rfc/rfc3236";
export const PdfFragmentSpec = "http://tools.ietf.org/rfc/rfc3778";
export const EpubFragmentSpec =
  "http://www.idpf.org/epub/linking/cfi/epub-cfi.html";
type FragmentSpec =
  | typeof HtmlFragmentSpec
  | typeof PdfFragmentSpec
  | typeof EpubFragmentSpec;

export type DocFragment = {
  value: string;
  spec: FragmentSpec;
};

export const createHtmlFragment = (value: string): DocFragment => ({
  value,
  spec: HtmlFragmentSpec,
});
export const createPdfFragment = (value: string): DocFragment => ({
  value,
  spec: PdfFragmentSpec,
});
export const createEpubFragment = (value: string): DocFragment => ({
  value,
  spec: EpubFragmentSpec,
});

export type FragmentSelector = {
  type: "FragmentSelector";
  conformsTo: FragmentSpec;
  value: string;
  refinedBy?: AnnotationSelector;
};

export type AnnotationSelector = FragmentSelector | QuoteSelector;

export const isQuoteSelector = (
  selector: AnnotationSelector
): selector is QuoteSelector => selector.type === "TextQuoteSelector";

export const isFragmentSelector = (
  selector: AnnotationSelector
): selector is FragmentSelector => selector.type === "FragmentSelector";

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
    selector: AnnotationSelector;
  };
};

export const createAnnotation = (
  source: string,
  selector: AnnotationSelector,
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
