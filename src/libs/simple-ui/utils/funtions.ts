export const getTarget = (event: Event): HTMLElement =>
  event.target as HTMLElement;

export const getInputTarget = (event: Event): HTMLInputElement =>
  event.target as HTMLInputElement;

export const focusElement = (element: HTMLElement): void => element.focus();

export const isKey = (key: string) => (event: KeyboardEvent): boolean =>
  event.code === key;

export const hasMetaKey = (event: KeyboardEvent): boolean => event.metaKey;

export const hasCtrlKey = (event: KeyboardEvent): boolean => event.ctrlKey;

export const hasNoKeyModifier = (event: KeyboardEvent): boolean =>
  !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
