import { Consumer, map, Provider } from "../../libs/connections";
import { diffArrayItems } from "../../libs/diff";
import { Component, div, JsonHtml } from "../../libs/simple-ui/render";

export type DiffBarClicked = {
  oldLines: Element[];
  newLines: Element[];
  position: number;
  revert: () => void;
};

export const diffGutter: Component<{
  changesProvider: Provider<Element>;
  initialContent: Element;
  onDiffBarClick: Consumer<DiffBarClicked>;
}> = ({ changesProvider, initialContent, onDiffBarClick }) => (render) => {
  const oldContent = getElements(initialContent);

  const renderGutter = (diffBars: JsonHtml[]) =>
    render(
      div(
        {
          id: "editor-gutter",
          class: "bg-gray position-absolute",
          style: { height: "100%", width: "8px" },
        },
        ...diffBars
      )
    );
  renderGutter([]);
  changesProvider(
    map((editorBody: Element) => {
      const editorY = editorBody.getBoundingClientRect().y;
      const newContent = getElements(editorBody);

      const changes = diffArrayItems(
        oldContent,
        newContent,
        (e1, e2) => e1.innerHTML === e2.innerHTML
      );
      return changes.map((change) => {
        const { newStart, newLines, oldLines, oldStart } = change;
        const startElement = newContent[newStart] as HTMLElement;

        const diffType = (() =>
          newLines === 0 ? "del" : oldLines === 0 ? "add" : "mod")();

        const elementTop = startElement.getBoundingClientRect().y;
        const calcHeight = (): number => {
          const endIndex = newStart + newLines - 1;
          const endElement = newContent[endIndex] as HTMLElement;
          const endRect = endElement.getBoundingClientRect();
          return endRect.y - elementTop + endRect.height;
        };
        const [top, height] =
          diffType === "del"
            ? [elementTop - editorY - 5, 10]
            : [elementTop - editorY, calcHeight()];

        return div({
          class: `diff ${diffType}`,
          title: diffType,
          style: {
            top: `${top}px`,
            height: `${height}px`,
          },
          onClick: () =>
            onDiffBarClick({
              oldLines: oldContent.slice(oldStart, oldStart + oldLines),
              newLines: newContent.slice(newStart, newStart + newLines),
              position: top,
              revert: () => {
                for (let i = 0; i < Math.min(oldLines, newLines); i++) {
                  const oldBlock = oldContent[i + oldStart];
                  editorBody.replaceChild(
                    oldBlock.cloneNode(true),
                    editorBody.children[newStart + i]
                  );
                }

                // bring back removed lines
                for (let i = 0; i < oldLines - newLines; i++) {
                  const oldBlock = oldContent[i + oldStart + newLines];
                  if (editorBody.children[newStart + i + 1]) {
                    editorBody.insertBefore(
                      oldBlock.cloneNode(true),
                      editorBody.children[newStart + i + 1]
                    );
                  } else {
                    editorBody.appendChild(oldBlock.cloneNode(true));
                  }
                }

                // remove new lines
                for (let i = 0; i < newLines - oldLines; i++) {
                  editorBody.removeChild(
                    editorBody.children[newStart + oldLines]
                  );
                }

                // trigger on change event to rerender diff gutter
                const evt = document.createEvent("HTMLEvents");
                evt.initEvent("input", false, true);
                editorBody.dispatchEvent(evt);
              },
            }),
        });
      });
    })(renderGutter)
  );
};

const getElements = (e?: Node | null): Element[] =>
  Array.from(e ? e.childNodes : []).filter(
    (node) => node.nodeType === Node.ELEMENT_NODE
  ) as Element[];
