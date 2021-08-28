import { div, JsonHtml } from "../../../libs/simple-ui/render";

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
const mktgGapPixels = new Map<Size, string>([
  ["none", ""],
  ["small", "16px"],
  ["medium", "32px"],
  ["large", "48px"],
  ["x-large", "64px"],
]);

export type ListOrientation = "horizontal" | "vertical";
type ListProps = {
  gap: Size;
  orientation: ListOrientation;
  marketing: boolean;
  class: string;
};
type ListPropsWithChildren = ChildrenProps<ListProps>;
const defaultListProps: ListProps = {
  gap: "medium",
  orientation: "horizontal",
  marketing: false,
  class: "",
};

const listPure = (
  { gap, orientation, marketing, class: className }: ListProps,
  children: JsonHtml[]
): JsonHtml =>
  div(
    {
      class:
        (orientation === "vertical"
          ? "d-flex flex-column"
          : "d-flex flex-items-center") + (className ? " " + className : ""),
      style: { gap: (marketing ? mktgGapPixels : gapPixels).get(gap) },
    },
    ...children
  );

export const list = (...props: ListPropsWithChildren): JsonHtml => {
  const [propsClean, children] = parseProps(props, defaultListProps);
  return listPure(propsClean, children);
};

export const stack = (
  ...props: ChildrenProps<Omit<ListProps, "orientation">>
): JsonHtml => {
  const [propsClean, children] = parseProps(props, defaultListProps);
  return listPure({ ...propsClean, orientation: "vertical" }, children);
};

export const inline = (
  ...props: ChildrenProps<Omit<ListProps, "orientation">>
): JsonHtml => {
  const [propsClean, children] = parseProps(props, defaultListProps);
  return listPure({ ...propsClean, orientation: "horizontal" }, children);
};
