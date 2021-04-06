import { OnCloseRegister, Provider } from "../connections";

import { SimplifiedElementsMap, SimplifiedEvent, SimplifiedEventMap } from "./dom";
import { Attributes, JsonMl, mapJsonMl, newTagFactory, TagName, TagProps } from "./jsonml";

// todo render should be independent from JsonML and accpet only raw dom
// there could be another jsonMl (jsonHtml) render that act as a glue code

type CustomEventMap = {
  display: SimplifiedEvent
}
export type EventMap = SimplifiedEventMap & CustomEventMap
type EventHandlers = {
  [K in keyof EventMap as `on${Capitalize<K>}`]: (event: EventMap[K]) => void;
};
type CustomElements = {
  slot: {
    key: string;
    componentHandler: ComponentRuntime;
  };
  // eslint-disable-next-line @typescript-eslint/ban-types
  fragment: {}
};

type Nodes = { [P in keyof SimplifiedElementsMap]: (SimplifiedElementsMap[P] & EventHandlers) } & CustomElements;

export type JsonHtml = JsonMl<Nodes>;
export type Slot = JsonHtml;
export type JsonHtmlProps = TagProps<Nodes>;
export type JsonHtmlAttrs<T extends TagName<Nodes>> = Attributes<Nodes, T>;

export type Renderer = (jsonml?: JsonHtml) => void;

export type Listener<K extends keyof EventMap> = (event: EventMap[K]) => void;

export type Handlers<T extends object> = {
  [K in keyof T]: (args: T[K]) => void;
};
type ComponentRuntime = (render: Renderer, onClose: OnCloseRegister) => void;
export type ComponentBody<P extends void | object> = (render: Renderer, onClose: OnCloseRegister) => P extends object ? Handlers<P> : void;
export type Component<T = void, P extends void | object = void> = (props: T) => ComponentBody<P>;

export const newSlot = <P extends object>(key: string, runtime: ComponentBody<P>): [Slot, Handlers<P>] => {
  let handlers: Handlers<P> | undefined;
  const proxy = new Proxy({}, {
    get: (_, prop) => (args: P[keyof P]) => {
      if (handlers) {
        return handlers[prop as keyof P](args);
      } else {
        console.error(`Can not trigger event "${String(prop)}" on inactive component in slot "${key}"`);
      }
    },
  }) as Handlers<P>;

  return [slot(key, (render, onClose) => {
    handlers = runtime(render, onClose) as unknown as Handlers<P>;
    onClose(() => handlers = undefined);
  }), proxy];
};

type Prop = string | number | boolean | Record<string, unknown> | Prop[] | undefined | Provider<unknown>;
type ViewProps = Record<string, Prop> | Prop | void;
export type View<T extends ViewProps = void> = (props: T) => JsonHtml;
export type OptionalView<T extends ViewProps = void> = (props: T) => JsonHtml | undefined;

// type ViewConfig = Record<string, Prop | Listener<any> | ComponentRuntime> | void;
export type ViewSetup<C = void, T extends ViewProps = void> = (
  config: C,
) => View<T>;
export type OptionalViewSetup<C = void, T extends ViewProps = void> = (
  config: C,
) => OptionalView<T>;

type Slots = Map<string, { element: Element; runtime: ComponentRuntime }>;

export const classList = (classes: Record<string, boolean>): string =>
  Object.keys(classes)
    .reduce((selectedClsses, className) => {
      if (classes[className]) {
        selectedClsses.push(className);
      }
      return selectedClsses;
    }, [] as string[])
    .join(" ");

function handleChildren(node: Node, slots: Slots, children: [Node, Slots][]) {
  children.forEach(([child, childSlots]) => {
    node.appendChild(child);
    childSlots.forEach((value, key) => {
      if (process.env.NODE_ENV !== "production") {
        if (slots.has(key)) {
          throw new Error(`Slot with the key "${key}" is duplicated. Slot key must be unique`);
        }
      }
      slots.set(key, value);
    });
  });
}

const trueBooleanAttributes = ["contenteditable"];

const convertToDom = (elem: JsonHtml): [Node, Slots] =>
  mapJsonMl<Nodes, [Node, Slots]>(
    elem,
    (string) => [document.createTextNode(string), new Map()],
    ([tag, attrs, children]) => {
      const slots: Slots = new Map();

      if (tag === "fragment") {
        const node = document.createDocumentFragment();
        handleChildren(node, slots, children);
        return [node, slots];
      }

      const node = document.createElement(tag);
      if (tag === "slot") {
        const { key, componentHandler } = attrs as CustomElements["slot"];
        slots.set(key, { runtime: componentHandler, element: node });
        return [node, slots];
      }

      for (const attrKey of Object.keys(attrs)) {
        const attrVal = (attrs as Attributes<Nodes, typeof tag>)[
          attrKey as keyof Attributes<Nodes, typeof tag>
        ];
        if (attrKey === "id") {
          node.id = attrVal as string;
        } else if (attrKey === "class") {
          for (const cls of (attrVal as string).split(" ")) {
            if (cls !== "") node.classList.add(cls);
          }
        } else if (attrKey === "style") {
          const styles = attrVal as CSSStyleDeclaration;
          for (const styleKey of Object.keys(styles)) {
            const styleKey1 = styleKey as keyof CSSStyleDeclaration;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            node.style[styleKey1] = styles[styleKey1];
          }
        } else if (attrKey === "dangerouslySetInnerHTML") {
          node.innerHTML = attrVal as string;
        } else if (typeof attrVal === "function") {
          const type = attrKey.substr(2).toLowerCase();
          const listener = attrVal as (event: Event) => void;
          if (type === "display") {
            setImmediate(() =>
              listener(({
                type: "display",
                target: node,
              } as unknown) as Event),
            );
          }
          node.addEventListener(type, (e: Event) => listener(e));
        } else if (typeof attrVal === "boolean") {
          attrVal
            ? trueBooleanAttributes.includes(attrKey) ? node.setAttribute(attrKey, "true") : node.setAttribute(attrKey, attrKey)
            : node.removeAttribute(attrKey);
        } else {
          node.setAttribute(attrKey, attrVal as string);
        }
      }

      handleChildren(node, slots, children);

      return [node, slots];
    },
  );

export type Deactivate = () => void;

const slotHandler = (parent: Element): Renderer => {
  const existingSlots = new Map<string,
    { element: Element; deactivate: Deactivate }>();

  return (jsonml?: JsonHtml) => {
    console.debug("render", jsonml);
    if (jsonml === undefined) {
      parent.innerHTML = "";
      return;
    }
    const [newChild, renderedSlots] = convertToDom(jsonml);

    const rendered = new Set<string>(renderedSlots.keys());
    const existing = new Set<string>(existingSlots.keys());

    // reuse existing slot that already have rendered content
    for (const slotKey of setIntersection(rendered, existing)) {
      const newElement = renderedSlots.get(slotKey)!.element;
      const oldElement = existingSlots.get(slotKey)!.element;
      if (newElement.parentNode) {
        // replace new slot by the old slot with the content
        newElement.parentNode.replaceChild(oldElement, newElement);
      } else {
        console.error("no-parent", oldElement);
      }
    }

    // activate components in newly rendered slots
    for (const slotKey of setDifference(rendered, existing)) {
      const { element, runtime } = renderedSlots.get(slotKey)!;
      const deactivate = setupComponent(runtime, element);
      existingSlots.set(slotKey, { element, deactivate });
    }

    // deactivate components for slots that disappeared
    for (const slotKey of setDifference(existing, rendered)) {
      const existingSlot = existingSlots.get(slotKey);
      existingSlot!.deactivate();
      existingSlots.delete(slotKey);
    }

    parent.innerHTML = "";
    parent.appendChild(newChild);
  };
};

export const setupComponent = (runtime: ComponentRuntime, element: Element): Deactivate => {
  const abortController = new AbortController();
  runtime(slotHandler(element), (handler) => {
    abortController.signal.addEventListener("abort", handler);
  });
  return () => abortController.abort();
};

const setDifference = <T>(setA: Set<T>, setB: Set<T>): Set<T> =>
  new Set([...setA].filter((x) => !setB.has(x)));

const setIntersection = <T>(setA: Set<T>, setB: Set<T>): Set<T> =>
  new Set([...setA].filter((x) => setB.has(x)));

export type ComponentItem<I, ID, T = void> = (props: T & { itemProvider: Provider<I>, id: ID }) => ComponentRuntime;

export const div = newTagFactory<Nodes>("div");
export const h1 = newTagFactory<Nodes>("h1");
export const h2 = newTagFactory<Nodes>("h2");
export const h3 = newTagFactory<Nodes>("h3");
export const h4 = newTagFactory<Nodes>("h4");
export const h5 = newTagFactory<Nodes>("h5");
export const h6 = newTagFactory<Nodes>("h6");
export const input = newTagFactory<Nodes>("input");
export const header = newTagFactory<Nodes>("header");
export const span = newTagFactory<Nodes>("span");
export const p = newTagFactory<Nodes>("p");
export const button = newTagFactory<Nodes>("button");
export const section = newTagFactory<Nodes>("section");
export const footer = newTagFactory<Nodes>("footer");
export const ul = newTagFactory<Nodes>("ul");
export const label = newTagFactory<Nodes>("label");
export const li = newTagFactory<Nodes>("li");
export const a = newTagFactory<Nodes>("a");
export const strong = newTagFactory<Nodes>("strong");
export const b = newTagFactory<Nodes>("b");
export const article = newTagFactory<Nodes>("article");
export const details = newTagFactory<Nodes>("details");
export const summary = newTagFactory<Nodes>("summary");
export const canvas = newTagFactory<Nodes>("canvas");
export const fragment = (...children: JsonHtml[]): JsonHtml => [
  "fragment",
  {},
  ...children,
];
export const slot = (key: string, onRender: ComponentBody<void>): Slot => [
  "slot",
  { componentHandler: onRender, key },
];

const hashCode = (str: string) => {
  let hash = 0,
    i,
    chr;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

export const slotForEntity = (key: string, entity: string | undefined, onRender: ComponentRuntime): JsonHtml => [
  "slot",
  { componentHandler: onRender, key: entity ? `${key}-${hashCode(entity)}` : key },
];

