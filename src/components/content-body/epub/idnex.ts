import * as JSZip from "jszip";

import { LinkedDataWithContent } from "../../../functions/content-processors";
import { Consumer } from "../../../libs/connections";
import { getBlobFile, getXmlFile, ZipObject } from "../../../libs/epub";
import { throwIfNull } from "../../../libs/errors";
import { measureAsyncTime } from "../../../libs/performance";
import {
  article,
  button,
  Component,
  div,
} from "../../../libs/simple-ui/render";
import { AnnotationDisplayRequest } from "../../annotations";
import { htmlView } from "../html-view";

function absolute(base: string, relative: string) {
  const separator = "/";
  const stack = base.split(separator),
    parts = relative.split(separator);
  stack.pop(); // remove current file name (or empty string)

  // (omit if "base" is the current folder without trailing slash)
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] == ".") continue;
    if (parts[i] == "..") stack.pop();
    else stack.push(parts[i]);
  }
  return stack.join(separator);
}

const prepareEpubPage = async (
  zip: ZipObject,
  file: string
): Promise<HTMLElement> => {
  const chapter = await getXmlFile(zip, file);
  const body = chapter.body;

  await Promise.all(
    Array.from(body.getElementsByTagName("img")).map((img) => {
      const src = img.getAttribute("src")!;
      getBlobFile(zip, absolute(file, src)).then((it) =>
        img.setAttribute("src", URL.createObjectURL(it))
      );
    })
  );

  return body;
};

export const epubDisplay: Component<
  {
    onAnnotationDisplayRequest: Consumer<AnnotationDisplayRequest>;
    onSelectionTrigger: () => void;
  },
  { displayContent: LinkedDataWithContent }
> = ({ onSelectionTrigger, onAnnotationDisplayRequest }) => (render) => {
  const renderChapter = (
    chapter: HTMLElement,
    {
      openChapter,
      currentChapter,
      numberOfChapters,
    }: {
      openChapter: (n: number) => void;
      currentChapter: number;
      numberOfChapters: number;
    }
  ) =>
    render(
      div(
        article({
          class: "markdown-body flex-1",
          dangerouslySetDom: chapter,
          // onMouseup: sendSelection,
          // onFocusout: sendSelection,
          // onDisplay: map(
          //   (e) => e.target as HTMLElement,
          //   fork(onDisplay, setContainerForSelect, resetEditBar)
          // ),
        }),
        htmlView({ content: chapter }),
        button(
          {
            class: "btn",
            onClick: () => {
              openChapter(currentChapter - 1);
            },
            disabled: currentChapter === 1,
          },
          "previous"
        ),
        button(
          {
            class: "btn",
            onClick: () => {
              openChapter(currentChapter + 1);
            },
            disabled: currentChapter === numberOfChapters,
          },
          "next"
        )
      )
    );

  return {
    displayContent: async ({ content }) => {
      const zip = await measureAsyncTime("read pdf metadata", () =>
        JSZip.loadAsync(content)
      )!;

      const container = await getXmlFile(zip, "META-INF/container.xml");

      const rootFile = throwIfNull(
        container.getElementsByTagName("rootfile").item(0)
      );
      const rootDir = "EPUB"; // todo we should compute it from the root file

      console.log(zip);

      const packageDoc = await getXmlFile(
        zip,
        throwIfNull(rootFile.getAttribute("full-path"))
      );

      console.log(packageDoc);
      const spine = packageDoc.getElementsByTagName("spine")[0];
      const spineItems = spine.getElementsByTagName("itemref");

      const openChapter = async (chapterNum: number) => {
        const itemRef = throwIfNull(
          spineItems[chapterNum - 1]?.getAttribute("idref")
        );
        const href = throwIfNull(
          packageDoc.getElementById(itemRef)?.getAttribute("href")
        );
        const document = await prepareEpubPage(zip, rootDir + "/" + href);
        renderChapter(document, {
          openChapter,
          currentChapter: chapterNum,
          numberOfChapters: spineItems.length,
        });
        window.scrollTo(0, 0);
      };

      openChapter(1);
    },
  };
};
