type NodeName = string;
type NodeAttributes = Record<string, unknown>;
type Nodes = Record<NodeName, NodeAttributes>;

export type TagName<N extends Nodes> = keyof N;

export type Attributes<N extends Nodes, T extends TagName<N>> = Partial<N[T]>;

export type JsonMl<N extends Nodes> =
  | [TagName<N>, Attributes<N, TagName<N>>, ...JsonMl<N>[]]
  | [TagName<N>, ...JsonMl<N>[]]
  | string;

export type TagProps<N extends Nodes> =
  | [Attributes<N, TagName<N>>, ...JsonMl<N>[]]
  | [...JsonMl<N>[]];

export type JsonMlTagFactory = <N extends Nodes>(
  tag: TagName<N>
) => (...props: TagProps<N>) => JsonMl<N>;

export const newTagFactory: JsonMlTagFactory = <N extends Nodes>(
  tag: TagName<N>
) => (...props) => [tag, ...props];

export const mapJsonMl = <N extends Nodes, T>(
  jsonMl: JsonMl<N>,
  onString: (v: string) => T,
  onNode: (a: [TagName<N>, Attributes<N, TagName<N>>, T[]]) => T
): T => {
  if (typeof jsonMl === "string") {
    return onString(jsonMl);
  }

  const [tag, ...rest]: [TagName<N>, ...TagProps<N>] = jsonMl;

  let attrs: Attributes<N, typeof tag> = {};

  if (rest.length === 0) {
    return onNode([tag, attrs, []]);
  }

  if (typeof rest[0] === "object" && !Array.isArray(rest[0])) {
    attrs = rest.shift() as Attributes<N, typeof tag>;
  }
  const children = rest as JsonMl<N>[];

  return onNode([
    tag,
    attrs,
    children.map((it: JsonMl<N>): T => mapJsonMl(it, onString, onNode)),
  ]);
};
