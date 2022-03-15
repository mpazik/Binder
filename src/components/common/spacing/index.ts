import type { JsonHtml } from "linki-ui";
import { div } from "linki-ui";

export type ChildrenProps<T> = [Partial<T>, ...JsonHtml[]] | [...JsonHtml[]];
const parseProps = <T extends object>(
  props: ChildrenProps<T>,
  defaultProps: T
): [T, JsonHtml[]] => {
  if (props.length === 0) {
    return [defaultProps, []];
  }

  if (typeof props[0] === "object" && !Array.isArray(props[0])) {
    const [attr, ...rest] = props;
    return [{ ...defaultProps, ...(attr as T) }, rest as JsonHtml[]];
  }
  return [defaultProps, props as JsonHtml[]];
};

export type Size = "none" | "small" | "medium" | "large" | "x-large";

export type InsetType = "square" | "squish" | "stretch";
type InsetProps = { size: Size; type: InsetType; class: string };
type InsetPropsWithChildren = ChildrenProps<InsetProps>;

const defaultInsetProps: InsetProps = {
  size: "medium",
  type: "squish",
  class: "",
};

const insetPaddings = new Map<InsetType, Map<Size, string>>([
  [
    "square",
    new Map([
      ["none", ""],
      ["small", "p-1"],
      ["medium", "p-2"],
      ["large", "p-3"],
      ["x-large", "p-5"],
    ]),
  ],
  [
    "squish",
    new Map([
      ["none", ""],
      ["small", "py-1 px-2"],
      ["medium", "py-2 px-3"],
      ["large", "py3 px-5"],
      ["x-large", "py-4 px-6"],
    ]),
  ],
  [
    "stretch",
    new Map([
      ["none", ""],
      ["small", "py-2 px-1"],
      ["medium", "py-3 px-2"],
      ["large", "py-5 px-3"],
      ["x-large", "py-6 px-4"],
    ]),
  ],
]);

export const inset = (...props: InsetPropsWithChildren): JsonHtml => {
  const [{ type, size, class: className }, children] = parseProps(
    props,
    defaultInsetProps
  );
  return div(
    {
      class:
        insetPaddings.get(type)!.get(size)! +
        (className ? " " + className : ""),
    },
    ...children
  );
};

const gapPixels = new Map<Size, string>([
  ["none", ""],
  ["small", "4px"],
  ["medium", "8px"],
  ["large", "16px"],
  ["x-large", "24px"],
]);

export type ListOrientation = "horizontal" | "vertical";

const defaultListProps: {
  gap: Size;
  orientation: ListOrientation;
  class: string;
} = {
  gap: "medium",
  orientation: "horizontal",
  class: "",
};

export const stack = (
  ...props: ChildrenProps<{
    gap: Size;
    class: string;
  }>
): JsonHtml => {
  const [{ gap, class: cssClass }, children] = parseProps(
    props,
    defaultListProps
  );
  return div(
    {
      class: `d-flex flex-column${cssClass ? " " + cssClass : ""}`,
      style: { gap: gapPixels.get(gap) },
    },
    ...children
  );
};

export const inline = (
  ...props: ChildrenProps<{
    gap: Size;
    class: string;
  }>
): JsonHtml => {
  const [{ gap, class: cssClass }, children] = parseProps(
    props,
    defaultListProps
  );
  return div(
    {
      class: `d-flex flex-items-center${cssClass ? " " + cssClass : ""}`,
      style: { gap: gapPixels.get(gap) },
    },
    ...children
  );
};
