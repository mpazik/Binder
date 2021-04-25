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

const tagsReadingKeyboardInput = ["INPUT", "TEXTAREA", "BUTTON"];
export const doesElementReadsInput = (element: Element): boolean => {
  const tagName = element.tagName;
  if (tagsReadingKeyboardInput.includes(tagName)) return true;
  return (
    tagName === "DIV" && element.getAttribute("contenteditable") === "true"
  );
};
