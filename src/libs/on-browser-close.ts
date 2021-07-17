export type RegisterBrowserClose = (action: () => string | void) => void;

export const onBrowserClose: RegisterBrowserClose = (action) => {
  window.addEventListener("beforeunload", (e) => {
    const message = action();
    if (!message) return;
    e.preventDefault();
    e.returnValue = message;
    return message;
  });
};
