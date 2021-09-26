import { diffArrayItems } from "../../../libs/diff";

export type DocumentChange = {
  changeType: "mod" | "add" | "del";
  oldLines: Element[];
  newLines: Element[];
  editor: Element;
};

export const newDocumentComparator = (
  initialEditor: HTMLElement
): ((editor: Element) => DocumentChange[]) => {
  const oldContent = getElements(initialEditor);

  return (editor: Element) => {
    const newContent = getElements(editor);

    return diffArrayItems(
      oldContent,
      newContent,
      (e1, e2) => e1.innerHTML === e2.innerHTML
    ).map(({ newStart, newLines, oldLines, oldStart }) => {
      return {
        changeType: newLines === 0 ? "del" : oldLines === 0 ? "add" : "mod",
        oldLines: oldContent.slice(oldStart, oldStart + oldLines),
        newLines: newContent.slice(newStart, newStart + newLines),
        editor,
      } as DocumentChange;
    });
  };
};

export const revertDocumentChange = ({
  oldLines,
  newLines,
  editor,
}: DocumentChange): void => {
  const newLinesNum = newLines.length;
  const oldLinesNum = oldLines.length;

  for (let i = 0; i < Math.min(oldLinesNum, newLinesNum); i++) {
    const oldBlock = oldLines[i];
    editor.replaceChild(oldBlock.cloneNode(true), newLines[i]);
  }

  // bring back removed lines
  for (let i = 0; i < oldLinesNum - newLinesNum; i++) {
    const oldBlock = oldLines[i + newLinesNum];
    if (editor.children[i + 1]) {
      editor.insertBefore(oldBlock.cloneNode(true), editor.children[i + 1]);
    } else {
      editor.appendChild(oldBlock.cloneNode(true));
    }
  }

  // remove new lines
  for (let i = 0; i < newLinesNum - oldLinesNum; i++) {
    editor.removeChild(editor.children[oldLinesNum]);
  }

  // trigger on change event to rerender diff gutter
  editor.dispatchEvent(new Event("input"));
};

export const revertDocument = (
  initialContent: Element,
  editor: Element
): void => {
  editor.innerHTML = initialContent.innerHTML;
  // trigger on change event to rerender diff gutter
  editor.dispatchEvent(new Event("input"));
};

const getElements = (e?: Node | null): Element[] =>
  Array.from(e ? e.childNodes : []).filter(
    (node) => node.nodeType === Node.ELEMENT_NODE
  ) as Element[];
