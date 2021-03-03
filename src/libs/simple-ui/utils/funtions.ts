export const getTarget = (event: Event): HTMLElement =>
  event.target as HTMLElement;

export const focusElement = (element: HTMLElement): void => element.focus();
