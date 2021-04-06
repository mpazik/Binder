const removeExtension = (name: string) => name.replace(/\.[^/.]+$/, "");

export const getNameFromUrl = (url: string): string | undefined => {
  try {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter((it) => it !== "");
    if (segments.length === 0) return undefined;

    const name = segments[segments.length - 1];
    if (name === "") return undefined;

    return decodeURI(removeExtension(name));
  } catch (e) {
    return undefined;
  }
};

export const getLinkedDataName = (
  documentTitle?: string,
  resourceName?: string
): string => documentTitle || resourceName || "untitled";
