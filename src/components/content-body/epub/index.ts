import * as JSZip from "jszip";

import { Callback, fork } from "../../../libs/connections";
import { map, to } from "../../../libs/connections/mappers";
import { getBlobFile, getXmlFile, ZipObject } from "../../../libs/epub";
import { throwIfNull } from "../../../libs/errors";
import { measureAsyncTime } from "../../../libs/performance";
import {
  button,
  Component,
  div,
  newSlot,
  ViewSetup,
} from "../../../libs/simple-ui/render";
import { createEpubFragment } from "../../annotations/annotation";
import { loaderWithContext } from "../../common/loader";
import { setupHtmlView } from "../html/view";
import { ContentComponent, DisplayContext } from "../types";

const absolute = (base: string, relative: string) => {
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
};

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

type EpubChapter = {
  currentChapter: number;
  numberOfChapters: number;
  content: HTMLElement;
};

type Epub = {
  spineItems: HTMLCollectionOf<Element>;
  packageDoc: Document;
  zip: JSZip;
  rootDir: string;
};

const openChapter = async (
  { spineItems, packageDoc, zip, rootDir }: Epub,
  chapterNum: number
): Promise<EpubChapter> => {
  const itemRef = throwIfNull(
    spineItems[chapterNum - 1]?.getAttribute("idref")
  );
  const href = throwIfNull(
    packageDoc.getElementById(itemRef)?.getAttribute("href")
  );
  return {
    currentChapter: chapterNum,
    numberOfChapters: spineItems.length,
    content: await prepareEpubPage(zip, rootDir + "/" + href),
  };
};

const openEpub = async (content: Blob): Promise<Epub> => {
  const zip: JSZip = throwIfNull(
    await measureAsyncTime("read pdf metadata", () => JSZip.loadAsync(content))
  ) as JSZip;

  const container = await getXmlFile(zip, "META-INF/container.xml");

  const rootFile = throwIfNull(
    container.getElementsByTagName("rootfile").item(0)
  );
  const rootDir = "EPUB"; // todo we should compute it from the root file

  const packageDoc = await getXmlFile(
    zip,
    throwIfNull(rootFile.getAttribute("full-path"))
  );

  const spine = packageDoc.getElementsByTagName("spine")[0];
  const spineItems = spine.getElementsByTagName("itemref");
  return {
    spineItems,
    rootDir,
    zip,
    packageDoc,
  };
};

const setupChapterView: ViewSetup<
  {
    openChapter: (n: number) => void;
    onSelectionTrigger: () => void;
    onDisplay: Callback<DisplayContext>;
  },
  EpubChapter
> = ({ openChapter, onDisplay }) => ({
  currentChapter,
  content,
  numberOfChapters,
}) =>
  div(
    setupHtmlView({
      onDisplay: (container) =>
        onDisplay({
          container,
          fragment: createEpubFragment("chapter=" + currentChapter),
        }),
    })({
      content: content,
    }),
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
  );

const contentComponent: Component<
  {
    onSelectionTrigger: () => void;
    onDisplay: Callback<DisplayContext>;
    onChapterOpen: Callback<number>;
  },
  { renderPage: EpubChapter }
> = ({ onChapterOpen, onDisplay, onSelectionTrigger }) => (render) => {
  const chapterView = setupChapterView({
    openChapter: onChapterOpen,
    onDisplay,
    onSelectionTrigger,
  });

  return {
    renderPage: map(chapterView, render),
  };
};

export const epubDisplay: ContentComponent = ({
  onSelectionTrigger,
  onDisplay,
}) => (render, onClose) => {
  const [contentSlot, { renderPage }] = newSlot(
    "epub-content",
    contentComponent({
      onSelectionTrigger,
      onDisplay,
      onChapterOpen: (it) => {
        load(it);
      },
    })
  );

  const { load, init } = loaderWithContext<Epub, number, EpubChapter>({
    fetcher: (epub, chapterNumber) => openChapter(epub, chapterNumber),
    onLoaded: renderPage,
    contentSlot,
  })(render, onClose);

  return {
    displayContent: fork(map(openEpub, init), map(to(1), load)),
  };
};
