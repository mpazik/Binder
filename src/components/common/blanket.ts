import type { JsonHtml } from "linki-ui";
import { div } from "linki-ui";

export const blanketStyles: Partial<CSSStyleDeclaration> = {
  top: "0",
  bottom: "0",
  left: "0",
  right: "0",
  position: "fixed",
};

export const blanket: typeof div = (...props) => {
  const attrs = (typeof props[0] === "object" && !Array.isArray(props[0])
    ? props.shift()
    : {}) as { style?: Partial<CSSStyleDeclaration> };

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
