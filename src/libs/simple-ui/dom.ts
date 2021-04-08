type HTMLElement = {
  autofocus: boolean;
  class: string;
  id: string;
  style: CSSStyleDeclaration;
  dangerouslySetInnerHTML: string;
  dangerouslySetDom: HTMLElement;
};
type HTMLAnchorElement = HTMLElement & {
  target: string;
  href: string;
};
type HTMLButtonElement = HTMLElement & {
  disabled: boolean;
};
type HTMLDetailsElement = HTMLElement & {
  open: boolean;
};
type HTMLInputElement = HTMLElement & {
  alt: string;
  autocomplete: string;
  checked: boolean;
  defaultChecked: boolean;
  defaultValue: string;
  disabled: boolean;
  max: string;
  maxLength: number;
  min: string;
  minLength: number;
  name: string;
  size: number;
  value: string;
  type: string;
  multiple: boolean;
  pattern: string;
  placeholder: string;
  readOnly: boolean;
  required: boolean;
};
type HTMLLIElement = HTMLElement & {
  value: number;
};
type HTMLLabelElement = HTMLElement & {
  for: string;
};
type HTMLCanvasElement = HTMLElement & {
  height: number;
  width: number;
};
type HTMLSlotElement = HTMLElement & {
  name: string;
};
type HTMLElementTagNameMap = {
  a: HTMLAnchorElement;
  // abbr: HTMLElement;
  address: HTMLElement;
  // applet: HTMLAppletElement;
  // area: HTMLAreaElement;
  article: HTMLElement;
  aside: HTMLElement;
  // audio: HTMLAudioElement;
  b: HTMLElement;
  // base: HTMLBaseElement;
  // basefont: HTMLBaseFontElement;
  // bdi: HTMLElement;
  // bdo: HTMLElement;
  // blockquote: HTMLQuoteElement;
  // body: HTMLBodyElement;
  br: HTMLElement;
  button: HTMLButtonElement;
  canvas: HTMLCanvasElement;
  // caption: HTMLTableCaptionElement;
  cite: HTMLElement;
  code: HTMLElement;
  // col: HTMLTableColElement;
  // colgroup: HTMLTableColElement;
  // data: HTMLDataElement;
  // datalist: HTMLDataListElement;
  dd: HTMLElement;
  // del: HTMLModElement;
  details: HTMLDetailsElement;
  dfn: HTMLElement;
  // dialog: HTMLDialogElement;
  // dir: HTMLDirectoryElement;
  div: HTMLElement;
  // dl: HTMLDListElement;
  dt: HTMLElement;
  em: HTMLElement;
  // embed: HTMLEmbedElement;
  // fieldset: HTMLFieldSetElement;
  figcaption: HTMLElement;
  figure: HTMLElement;
  // font: HTMLFontElement;
  footer: HTMLElement;
  // form: HTMLFormElement;
  // frame: HTMLFrameElement;
  // frameset: HTMLFrameSetElement;
  h1: HTMLElement;
  h2: HTMLElement;
  h3: HTMLElement;
  h4: HTMLElement;
  h5: HTMLElement;
  h6: HTMLElement;
  head: HTMLElement;
  header: HTMLElement;
  hgroup: HTMLElement;
  // hr: HTMLHRElement;
  // html: HTMLHtmlElement;
  i: HTMLElement;
  // iframe: HTMLIFrameElement;
  // img: HTMLImageElement;
  input: HTMLInputElement;
  // ins: HTMLModElement;
  kbd: HTMLElement;
  label: HTMLLabelElement;
  // legend: HTMLLegendElement;
  li: HTMLLIElement;
  // link: HTMLLinkElement;
  // main: HTMLElement;
  // map: HTMLMapElement;
  mark: HTMLElement;
  // marquee: HTMLMarqueeElement;
  // menu: HTMLMenuElement;
  // meta: HTMLMetaElement;
  // meter: HTMLMeterElement;
  nav: HTMLElement;
  // noscript: HTMLElement;
  // object: HTMLObjectElement;
  // ol: HTMLOListElement;
  // optgroup: HTMLOptGroupElement;
  // option: HTMLOptionElement;
  // output: HTMLOutputElement;
  p: HTMLElement;
  // param: HTMLParamElement;
  // picture: HTMLPictureElement;
  // pre: HTMLPreElement;
  // progress: HTMLProgressElement;
  // q: HTMLQuoteElement;
  // rp: HTMLElement;
  // rt: HTMLElement;
  // ruby: HTMLElement;
  s: HTMLElement;
  samp: HTMLElement;
  // script: HTMLScriptElement;
  section: HTMLElement;
  // select: HTMLSelectElement;
  slot: HTMLSlotElement;
  small: HTMLElement;
  // source: HTMLSourceElement;
  span: HTMLElement;
  strong: HTMLElement;
  // style: HTMLStyleElement;
  sub: HTMLElement;
  summary: HTMLElement;
  sup: HTMLElement;
  // table: HTMLTableElement;
  // tbody: HTMLTableSectionElement;
  // td: HTMLTableDataCellElement;
  // template: HTMLTemplateElement;
  // textarea: HTMLTextAreaElement;
  // tfoot: HTMLTableSectionElement;
  // th: HTMLTableHeaderCellElement;
  // thead: HTMLTableSectionElement;
  // time: HTMLTimeElement;
  // title: HTMLTitleElement;
  // tr: HTMLTableRowElement;
  // track: HTMLTrackElement;
  u: HTMLElement;
  ul: HTMLElement;
  var: HTMLElement;
  // video: HTMLVideoElement;
  wbr: HTMLElement;
};

// type Event = {
//   readonly currentTarget: EventTarget | null;
//   readonly target: EventTarget | null;
//   readonly type: string;
// };
// type UIEvent = Event;
// type MouseEvent = UIEvent & {
//   readonly altKey: boolean;
//   readonly button: number;
//   readonly buttons: number;
//   readonly clientX: number;
//   readonly clientY: number;
//   readonly ctrlKey: boolean;
//   readonly metaKey: boolean;
//   readonly movementX: number;
//   readonly movementY: number;
//   readonly offsetX: number;
//   readonly offsetY: number;
//   readonly pageX: number;
//   readonly pageY: number;
//   readonly relatedTarget: EventTarget | null;
//   readonly screenX: number;
//   readonly screenY: number;
//   readonly shiftKey: boolean;
//   readonly x: number;
//   readonly y: number;
// };
//
// type KeyboardEvent = UIEvent & {
//   readonly altKey: boolean;
//   readonly code: string;
//   readonly ctrlKey: boolean;
//   readonly isComposing: boolean;
//   readonly key: string;
//   readonly location: number;
//   readonly metaKey: boolean;
//   readonly repeat: boolean;
//   readonly shiftKey: boolean;
// };
//
// type PointerEvent = MouseEvent & {
//   readonly height: number;
//   readonly isPrimary: boolean;
//   readonly pointerId: number;
//   readonly pointerType: string;
//   readonly pressure: number;
//   readonly tangentialPressure: number;
//   readonly tiltX: number;
//   readonly tiltY: number;
//   readonly twist: number;
//   readonly width: number;
// };
//
// type TouchEvent = UIEvent & {
//   readonly altKey: boolean;
//   readonly changedTouches: TouchList;
//   readonly ctrlKey: boolean;
//   readonly metaKey: boolean;
//   readonly shiftKey: boolean;
//   readonly targetTouches: TouchList;
//   readonly touches: TouchList;
// };

// type DragEvent = MouseEvent & {
//   readonly dataTransfer: DataTransfer | null;
// };
//
// type HTMLElementEventMap = {
//   // "abort": UIEvent;
//   // "animationcancel": AnimationEvent;
//   // "animationend": AnimationEvent;
//   // "animationiteration": AnimationEvent;
//   // "animationstart": AnimationEvent;
//   // "auxclick": MouseEvent;
//   blur: UIEvent;
//   cancel: Event;
//   canplay: Event;
//   canplaythrough: Event;
//   change: Event;
//   click: MouseEvent;
//   close: Event;
//   contextmenu: MouseEvent;
//   cuechange: Event;
//   dblclick: MouseEvent;
//   drag: DragEvent;
//   dragend: DragEvent;
//   dragenter: DragEvent;
//   dragexit: Event;
//   dragleave: DragEvent;
//   dragover: DragEvent;
//   dragstart: DragEvent;
//   drop: DragEvent;
//   durationchange: Event;
//   emptied: Event;
//   ended: Event;
//   // "error": ErrorEvent;
//   focus: FocusEvent;
//   focusin: FocusEvent;
//   focusout: FocusEvent;
//   // "gotpointercapture": PointerEvent;
//   input: Event;
//   invalid: Event;
//   keydown: KeyboardEvent;
//   keypress: KeyboardEvent;
//   keyup: KeyboardEvent;
//   load: Event;
//   loadeddata: Event;
//   loadedmetadata: Event;
//   loadstart: Event;
//   lostpointercapture: PointerEvent;
//   mousedown: MouseEvent;
//   mouseenter: MouseEvent;
//   mouseleave: MouseEvent;
//   mousemove: MouseEvent;
//   mouseout: MouseEvent;
//   mouseover: MouseEvent;
//   mouseup: MouseEvent;
//   pause: Event;
//   play: Event;
//   playing: Event;
//   pointercancel: PointerEvent;
//   pointerdown: PointerEvent;
//   pointerenter: PointerEvent;
//   pointerleave: PointerEvent;
//   pointermove: PointerEvent;
//   pointerout: PointerEvent;
//   pointerover: PointerEvent;
//   pointerup: PointerEvent;
//   // "progress": ProgressEvent;
//   ratechange: Event;
//   reset: Event;
//   resize: UIEvent;
//   scroll: Event;
//   // "securitypolicyviolation": SecurityPolicyViolationEvent;
//   seeked: Event;
//   seeking: Event;
//   select: Event;
//   selectionchange: Event;
//   selectstart: Event;
//   stalled: Event;
//   submit: Event;
//   suspend: Event;
//   timeupdate: Event;
//   toggle: Event;
//   touchcancel: TouchEvent;
//   touchend: TouchEvent;
//   touchmove: TouchEvent;
//   touchstart: TouchEvent;
//   // "transitioncancel": TransitionEvent;
//   // "transitionend": TransitionEvent;
//   // "transitionrun": TransitionEvent;
//   // "transitionstart": TransitionEvent;
//   // volumechange: Event;
//   // waiting: Event;
//   // "wheel": WheelEvent;
// };

export type SimplifiedEvent = Event;
export type SimplifiedEventMap = HTMLElementEventMap;
export type SimplifiedElementsMap = HTMLElementTagNameMap;
