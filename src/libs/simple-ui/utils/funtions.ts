import { link, map } from "linki";

export const getTarget = (event: Event): HTMLElement =>
  event.target as HTMLElement;

export const getInputTarget = (event: Event): HTMLInputElement =>
  event.target as HTMLInputElement;

export const focusElement = (element: HTMLElement): void => element.focus();

export const selectInput = (input: HTMLInputElement): void =>
  input.setSelectionRange(0, input.value.length);

export const selectInputTarget = link(map(getInputTarget), selectInput);

export const resetInput = (input: HTMLInputElement): void => {
  input.value = "";
};

export const resetInputTarget = link(map(getInputTarget), resetInput);

export const preventDefault = (event: Event): void => event.preventDefault();

export const inputValue = (input: HTMLInputElement): string => input.value;
export const trim = (text: string): string => text.trim();

export const isKey = (key: string) => (event: KeyboardEvent): boolean =>
  event.code === key;

export const hasMetaKey = (event: KeyboardEvent): boolean => event.metaKey;

export const hasCtrlKey = (event: KeyboardEvent): boolean => event.ctrlKey;

export const hasNoKeyModifier = (event: KeyboardEvent): boolean =>
  !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
