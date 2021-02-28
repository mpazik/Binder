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
  motivation?: "commenting" | "highlighting";
  body?: TextualBody;
  target: {
    source: string;
    selector: QuoteSelector;
  };
};

export const createAnnotation = (
  source: string,
  selector: QuoteSelector,
  htmlBody?: string
): Annotation => ({
  "@context": "http://www.w3.org/ns/anno.jsonld",
  type: "Annotation",
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

export const annotation: Annotation = createAnnotation(
  "nih:sha-256;0ea13c00e7c872d446332715f7bc71bcf8ed9c864ac0be09814788667cbf1f1f",
  {
    type: "TextQuoteSelector",
    exact: "synem i uczniem rzeźbiarza Patroklesa[1], wymienionego",
    prefix: "Był ",
    suffix: " przez",
  },
  "Some <b>comment</b>"
);
