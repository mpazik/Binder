import * as JSZip from "jszip";
import {
  cast,
  defined,
  definedTuple,
  filter,
  fork,
  link,
  map,
  passUndefined,
  pick,
  pipe,
  valueWithState,
  withDefaultValue,
  withOptionalState,
} from "linki";
import type { JsonHtml, UiComponent, View } from "linki-ui";
import { a, div, dom, mountComponent, renderJsonHtmlToDom } from "linki-ui";

import {
  newUriWithFragment,
  updateFragment,
} from "../../../libs/browser-providers";
import type { ZipObject } from "../../../libs/epub";
import { getBlobFile, getXmlFile } from "../../../libs/epub";
import type { EpubCfi } from "../../../libs/epubcfi";
import {
  customParseFirstSegmentEpubCfi,
  emptyEpubCfi,
  generateEpubCfi,
  generateEpubCfiFromNodes,
  generateEpubCfiPartForId,
  generateEpubCfiPartForNode,
  getCfiParts,
  nodeIdFromCfiPart,
} from "../../../libs/epubcfi";
import { throwIfNull } from "../../../libs/errors";
import { pickContext, withContext } from "../../../libs/linki";
import { measureAsyncTime } from "../../../libs/performance";
import { createEpubFragment } from "../../annotations/annotation";
import { loaderWithContext } from "../../common/loader";
import { htmlView } from "../html/view";
import type { ContentComponent, DisplayContext } from "../types";
import {
  isFocusedElementStatic,
  lastSeenElement,
  scrollToFragmentOrTop,
  scrollToTop,
} from "../utils";

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
  file: string,
  packageDoc: Document,
  rootFilePath: string
): Promise<HTMLElement> => {
  const filePath = absolute(rootFilePath, file);
  const chapter = await getXmlFile(zip, filePath);
  const body = chapter.body;

  Array.from(body.getElementsByTagName("a")).forEach((anchor) => {
    const url = anchor.getAttribute("href");
    if (!url || url.includes(":")) return anchor;

    const { uri, fragment } = newUriWithFragment(url);
    const path = uri === "" ? file : absolute(file, uri);
    const manifestItem = packageDoc.querySelector(
      `manifest > item[href='${path}']`
    );
    if (!manifestItem) {
      console.error(`Could not find item in manifest for '${path}'`);
      return anchor;
    }

    anchor.setAttribute(
      "href",
      `#${generateEpubCfi(
        generateEpubCfiPartForNode(manifestItem),
        ...(fragment ? [generateEpubCfiPartForId(fragment)] : [])
      )}`
    );

    return anchor;
  });

  await Promise.all(
    Array.from(body.getElementsByTagName("img")).map((img) => {
      const src = img.getAttribute("src")!;
      // reset src for the time we fetch the data as it seems that browser tries prefetch the image even if dom is not printed yet
      img.setAttribute("src", "");
      getBlobFile(zip, absolute(filePath, src))
        .then((it) => img.setAttribute("src", URL.createObjectURL(it)))
        .catch((it) => console.error(it));
    })
  );

  const parent = document.createElement("div");
  Array.from(body.children).forEach((child) => parent.appendChild(child));
  return parent;
};

type EpubChapter = {
  currentChapter: EpubCfi;
  nextChapter?: EpubCfi;
  previousChapter?: EpubCfi;
  content: HTMLElement;
  navigation?: EpubCfi;
};

type Epub = {
  packageDoc: Document;
  zip: JSZip;
  rootFilePath: string;
};

const openChapter = async (
  { packageDoc, zip, rootFilePath }: Epub,
  fragment: EpubCfi
): Promise<EpubChapter> => {
  const getManifestItem = (item: ChildNode) =>
    throwIfNull(
      packageDoc.getElementById(
        throwIfNull((item as Element).getAttribute("idref"))
      )
    );

  const { chapterItem, manifestItem, currentChapter } = (() => {
    if (fragment === emptyEpubCfi) {
      const chapterItem = throwIfNull(
        packageDoc.querySelector("spine > itemref")
      );
      const manifestItem = getManifestItem(chapterItem);
      return {
        chapterItem,
        manifestItem,
        currentChapter: generateEpubCfiFromNodes(manifestItem),
      };
    }
    const manifestItem = customParseFirstSegmentEpubCfi(fragment, packageDoc);
    return {
      chapterItem: throwIfNull(
        packageDoc.querySelector(
          `spine > itemref[idref='${throwIfNull(manifestItem.id)}']`
        )
      ),
      manifestItem,
      currentChapter: fragment,
    };
  })();

  const path = throwIfNull(manifestItem.getAttribute("href"));

  const cfiForChapterItem = (sibling: Element | null) =>
    passUndefined(pipe(getManifestItem, generateEpubCfiFromNodes))(
      sibling ?? undefined
    );

  return {
    currentChapter,
    content: await prepareEpubPage(zip, path, packageDoc, rootFilePath),
    previousChapter: cfiForChapterItem(chapterItem.previousElementSibling),
    nextChapter: cfiForChapterItem(chapterItem.nextElementSibling),
    navigation: passUndefined(generateEpubCfiFromNodes)(
      packageDoc.getElementById("nav") ?? undefined
    ),
  };
};

const openEpub = async (content: Blob): Promise<Epub> => {
  const zip: JSZip = throwIfNull(
    await measureAsyncTime("read epub metadata", () => JSZip.loadAsync(content))
  ) as JSZip;
  const container = await getXmlFile(zip, "META-INF/container.xml");
  const rootFilePath = throwIfNull(
    container
      .getElementsByTagName("rootfile")
      .item(0)
      ?.getAttribute("full-path")
  );
  const packageDoc = await getXmlFile(zip, rootFilePath);
  console.log("Epub package", packageDoc);
  return {
    rootFilePath,
    zip,
    packageDoc,
  };
};

const epubNav: View<{
  nextChapter?: string;
  previousChapter?: string;
  navigation?: string;
}> = ({ previousChapter, nextChapter, navigation }) =>
  div(
    {
      class:
        "d-flex flex-justify-between flex-items-center with-line-length-settings",
    },
    a(
      {
        href: `#${previousChapter ?? ""}`,
        style: { visibility: previousChapter ? "visible" : "hidden" },
      },
      "← previous"
    ),
    a(
      {
        href: `#${navigation ?? ""}`,
        style: { visibility: navigation ? "visible" : "hidden" },
      },
      "navigation"
    ),
    a(
      {
        href: `#${nextChapter ?? ""}`,
        style: { visibility: nextChapter ? "visible" : "hidden" },
      },
      "next →"
    )
  );

const chapterContainer: View<EpubChapter> = ({ content }) =>
  htmlView({
    extraClass: "book",
    content,
  });

const chapterView: View<
  {
    container: JsonHtml;
  } & EpubChapter
> = ({ container, nextChapter, previousChapter, navigation }) =>
  div(
    epubNav({ previousChapter, navigation, nextChapter }),
    container,
    epubNav({ previousChapter, navigation, nextChapter })
  );

const contentComponent: UiComponent<
  { renderPage: EpubChapter },
  { onDisplay: DisplayContext }
> = ({ onDisplay, render }) => {
  return {
    renderPage: link(
      map(withContext(pipe(chapterContainer, renderJsonHtmlToDom, cast()))),
      fork<[EpubChapter, HTMLElement]>(
        link(
          map(([epub, container]) =>
            chapterView({
              ...epub,
              container: dom(container),
            })
          ),
          render
        ),
        link(map(pickContext()), scrollToTop),
        link(
          map(([{ currentChapter }, container]) => ({
            container,
            fragmentForAnnotations: createEpubFragment(currentChapter),
            fragment: currentChapter,
          })),
          onDisplay
        )
      )
    ),
  };
};

const autoScroll = ({ fragment, container }: DisplayContext) => {
  scrollToFragmentOrTop(
    container,
    passUndefined<string, string | undefined>((fragment) =>
      passUndefined(nodeIdFromCfiPart)(getCfiParts(fragment)[1])
    )(fragment)
  );
};

export const epubDisplay: ContentComponent = ({
  onDisplay,
  onCurrentFragmentResponse,
  render,
}) => {
  const [contentSlot, { renderPage }] = mountComponent(contentComponent, {
    onDisplay: fork(autoScroll, onDisplay, (it) => setContainerContext(it)),
  });

  const [changeChapter, setChapter] = link(
    valueWithState<EpubChapter | undefined, KeyboardEvent>(undefined),
    filter(definedTuple),
    filter(isFocusedElementStatic),
    ([chapter, keyboardEvent]) => {
      if (keyboardEvent.key === "ArrowLeft" && chapter.previousChapter) {
        updateFragment(chapter.previousChapter);
      } else if (keyboardEvent.key === "ArrowRight" && chapter.nextChapter) {
        updateFragment(chapter.nextChapter);
      }
    }
  );

  const [returnCurrentFragment, setContainerContext] = link(
    withOptionalState<DisplayContext | undefined>(undefined),
    filter(defined),
    map(({ container, fragment }) => {
      if (!fragment)
        throw new Error(
          "Fragment for epub was not defined but expected to always be"
        );
      const element = lastSeenElement(container);
      if (!element) return fragment;
      const parts = getCfiParts(fragment);
      if (parts.length === 0 || parts.length > 2) {
        console.error("Unexpected ebupCfi", parts);
        return fragment;
      }
      return generateEpubCfi(parts[0], generateEpubCfiPartForId(element.id));
    }),
    onCurrentFragmentResponse
  );

  document.addEventListener("keyup", changeChapter);

  const { load, init, stop } = loaderWithContext<Epub, EpubCfi, EpubChapter>({
    fetcher: (epub, fragment) => openChapter(epub, fragment),
    onLoaded: fork(renderPage, setChapter),
    contentSlot,
  })({ render });

  return {
    displayContent: fork(
      link(map(pick("content"), openEpub), init),
      link(map(pick("fragment"), withDefaultValue(emptyEpubCfi)), load)
    ),
    goToFragment: link(filter(defined), load),
    requestCurrentFragment: returnCurrentFragment,
    stop: fork(stop ?? (() => {}), () => {
      document.removeEventListener("keyup", changeChapter);
    }),
  };
};
