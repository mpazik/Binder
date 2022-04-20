export const scrollToTop = (container?: HTMLElement): void => {
  const { x, y } = container
    ? container.getBoundingClientRect()
    : { x: 0, y: 0 };
  window.scrollTo(x + window.pageXOffset, y + window.pageYOffset);
};

export const scrollToElement = (elementId: string): void => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`there is not element for id: ${elementId}`);
    return;
  }
  element.scrollIntoView();
};

export const scrollToFragmentOrTop = (
  container?: HTMLElement,
  fragment?: string
): void => {
  // if there is no page fragment go to top of the page to show linked data, ideally it should be the top of the full content container
  if (fragment) {
    scrollToElement(fragment);
    return;
  }
  scrollToTop(container);
};

export const lastSeenElement = (
  container: HTMLElement = document.body
): HTMLElement | undefined => {
  const elementsWithIds = Array.from(
    container.querySelectorAll("[id]")
  ) as HTMLElement[];
  let lastSeenElement: HTMLElement | undefined;
  for (const element of elementsWithIds) {
    // if element is in the front of the top of the the view port - stop searching
    if (element.offsetTop > window.pageYOffset) break;
    lastSeenElement = element;
  }
  return lastSeenElement;
};
const tagsReadingKeyboardInput = ["INPUT", "TEXTAREA", "BUTTON"];

export const doesElementReadsInput = (element: Element): boolean => {
  const tagName = element.tagName;
  if (tagsReadingKeyboardInput.includes(tagName)) return true;
  return (
    tagName === "DIV" && element.getAttribute("contenteditable") === "true"
  );
};

export const isFocusedElementStatic = (): boolean =>
  document.activeElement
    ? !doesElementReadsInput(document.activeElement)
    : true;
