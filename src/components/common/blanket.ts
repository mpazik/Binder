import {
  div,
  JsonHtml,
  JsonHtmlAttrs,
  JsonHtmlProps,
} from "../../libs/simple-ui/render";

export const blanketStyles: Partial<CSSStyleDeclaration> = {
  top: "0",
  bottom: "0",
  left: "0",
  right: "0",
  position: "fixed",
};

export const blanket = (...props: JsonHtmlProps): JsonHtml => {
  const attrs = (typeof props[0] === "object" && !Array.isArray(props[0])
    ? props.shift()
    : {}) as JsonHtmlAttrs<"div">;

  return div(
    {
      ...attrs,
      style: {
        ...(attrs.style ? attrs.style : {}),
        ...blanketStyles,
      },
    },
    ...(props as JsonHtml[])
  );
};
