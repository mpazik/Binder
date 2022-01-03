import type { Callback } from "linki";
import {
  and,
  async,
  debounce,
  defined,
  definedTuple,
  filter,
  fork,
  ignoreParam,
  is,
  link,
  map,
  pick,
  split,
  to,
  valueWithState,
  withState,
} from "linki";
import type { JsonHtml, View } from "linki-ui";
import {
  div,
  dom,
  input,
  li,
  renderJsonHtmlToDom,
  small,
  span,
  ul,
} from "linki-ui";

import type { RecentDocuments } from "../../functions/recent-document-serach";
import type { UriWithFragment } from "../../libs/browser-providers";
import { newUriWithFragment } from "../../libs/browser-providers";
import type {
  ElementComponent,
  ViewSetup,
} from "../../libs/simple-ui/new-renderer";
import { createUiComponent } from "../../libs/simple-ui/new-renderer";
import {
  focusElement,
  getInputTarget,
  hasNoKeyModifier,
  isKey,
  preventDefault,
  resetInput,
  selectInputTarget,
} from "../../libs/simple-ui/utils/funtions";
import { specialDirectoryUri } from "../app/special-uris";
import { relativeDate } from "../common/relative-date";
import { isFocusedElementStatic } from "../content-body/utils";

// @ts-ignore
export const blur = (): void => document.activeElement?.blur();

const setupAutoCompleteFrame: ViewSetup<
  { setInteracting: () => void; footer?: JsonHtml },
  JsonHtml
> = ({ setInteracting, footer }) => (content) =>
  div(
    {
      class: "autocomplete-results",
      onMouseDown: link(map(to(true)), setInteracting),
      style: {
        overflowY: "hidden",
        maxHeight: "fit-content",
      },
    },
    content,
    ...(footer ? [footer] : [])
  );

const setupSuggestionsView = <T>({
  onSelected,
  getOptionLabel,
}: {
  onSelected: Callback<T>;
  getOptionLabel: (item: T) => JsonHtml;
}): View<{ suggestions: T[] }> => ({ suggestions }) =>
  ul(
    {
      style: {
        overflowY: "auto",
        maxHeight: "20em",
      },
    },
    ...suggestions.map((suggestion) =>
      li(
        {
          class: "autocomplete-item",
          onClick: link(map(to(suggestion)), onSelected),
        },
        getOptionLabel(suggestion)
      )
    )
  );

const noItemsView = () => div({ class: "p-2" }, "No results");

export const createAutocompleteList = <T>(): ElementComponent<
  {
    onSelected: (s: T) => void;
    getOptionLabel: (item: T) => JsonHtml;
    footer?: JsonHtml;
  },
  {
    renderList: T[];
    hideList: void;
    highlightNextItem: void;
    highlightPreviousItem: void;
    selectHighlighted: void;
  }
> =>
  createUiComponent(({ onSelected, getOptionLabel, footer }, render) => {
    const [selectHighlighted, setHighlighted] = link(
      withState<HTMLElement | undefined>(undefined),
      filter(defined),
      (element) => {
        element.click();
      }
    );

    const [move, setDom] = link(
      valueWithState<HTMLElement | undefined, "next" | "previous">(undefined),
      filter(definedTuple),
      ([dom, direction]) => {
        const selected = dom.querySelector('[aria-selected="true"]');
        if (selected) selected.removeAttribute("aria-selected");

        const newSelected =
          direction === "next"
            ? selected?.nextElementSibling
              ? selected.nextElementSibling
              : dom.querySelector("li")
            : selected?.previousElementSibling
            ? selected.previousElementSibling
            : dom.querySelector("li:last-child");

        if (newSelected) {
          setHighlighted(newSelected as HTMLElement);
          newSelected.setAttribute("aria-selected", "true");
        }
      }
    );

    const autoCompleteFrame = setupAutoCompleteFrame({
      setInteracting: () => setInteracting(true),
      footer,
    });
    const suggestionsView = setupSuggestionsView({
      getOptionLabel,
      onSelected,
    });

    const renderList = fork<T[] | undefined>(
      link(map(to(undefined)), fork(setDom)),
      link(map(to(undefined)), setHighlighted),
      link(
        map((suggestions) => {
          if (suggestions === undefined) return undefined;
          if (suggestions.length > 0) {
            const suggestionsDom = renderJsonHtmlToDom(
              suggestionsView({ suggestions })
            ) as HTMLElement;
            setDom(suggestionsDom);
            return autoCompleteFrame(dom(suggestionsDom));
          }
          return autoCompleteFrame(noItemsView());
        }),
        render
      )
    );

    const [hideList, setInteracting] = link(
      withState(false),
      // ignore hide command triggered by on-blur from input when mouse click on the dropdown list
      filter(is(false)),
      map(to(undefined)),
      renderList
    );

    return {
      renderList,
      hideList: fork(hideList, link(map(to(false)), setInteracting)),
      highlightNextItem: () => move("next"),
      highlightPreviousItem: () => move("previous"),
      selectHighlighted,
    };
  });

const toUrl = (s: string) => new URL(s);
const isUrl = (s: string) => {
  try {
    toUrl(s);
    return true;
  } catch (e) {
    return false;
  }
};

const searchFocusShortCutKey = "Slash";

export const searchBox: ElementComponent<
  {
    onSearch: (term: string) => Promise<RecentDocuments[]>;
    onSelected: (url: UriWithFragment) => void;
  },
  { start: void; stop: void }
> = ({ onSearch, onSelected }) => {
  const selectUrl = (url: UriWithFragment) => {
    hideList();
    resetSearchInput();
    onSelected(url);
  };

  const goToDirectory = () => selectUrl({ uri: specialDirectoryUri });
  const [
    suggestionsSlot,
    {
      renderList,
      highlightPreviousItem,
      highlightNextItem,
      selectHighlighted,
      hideList,
    },
  ] = createAutocompleteList<RecentDocuments>()({
    onSelected: link(map(pick("uriWithFragment")), selectUrl),
    getOptionLabel: ({ name, startDate }) => {
      if (startDate)
        return span(
          name,
          small(
            { class: "float-right text-normal" },
            relativeDate({ date: startDate })
          )
        );
      return name;
    },
    footer: div(
      {
        class: "py-1 text-center autocomplete-item",
        onClick: goToDirectory,
      },
      "List all documents [Tab]"
    ),
  });

  const trigger = (): void => selectHighlighted();

  const keyHandlers: Map<string, (event: KeyboardEvent) => void> = new Map([
    ["Enter", trigger],
    ["Tab", goToDirectory],
    ["Escape", () => fork(hideList, blur)()],
    ["ArrowDown", () => highlightNextItem()],
    ["ArrowUp", () => highlightPreviousItem()],
  ]);

  const renderSearch = link(map(onSearch), async(), [
    renderList,
    (e) => console.error(e),
  ]);

  const inputElement = renderJsonHtmlToDom(
    input({
      class: "form-control width-full",
      type: "text",
      placeholder: `Search or open new url [ / ]`,
      onFocus: fork(selectInputTarget, () => {
        renderSearch("");
      }),
      onInput: link(
        map(getInputTarget, (input) => input.value.trim()),
        debounce(100),
        link(split(isUrl), [
          link(map(newUriWithFragment), selectUrl),
          renderSearch,
        ])
      ),
      onBlur: () => hideList(),
      onKeyDown: (event) => {
        const handler = keyHandlers.get(event.key);
        if (!handler) return;
        handler(event);
        event.stopPropagation();
        event.preventDefault();
      },
    })
  ) as HTMLInputElement;
  const resetSearchInput = () => resetInput(inputElement);
  const focusInput = () => focusElement(inputElement);

  const keyHandler: (e: KeyboardEvent) => void = link(
    filter(
      and(
        isKey(searchFocusShortCutKey),
        hasNoKeyModifier,
        isFocusedElementStatic
      )
    ),
    fork(link(ignoreParam(), focusInput), preventDefault)
  );

  return [
    renderJsonHtmlToDom(
      div(
        { class: "position-relative" },
        dom(inputElement),
        dom(suggestionsSlot)
      )
    ) as HTMLElement,
    {
      start: () => {
        document.addEventListener("keydown", keyHandler);
      },
      stop: () => {
        document.removeEventListener("keydown", keyHandler);
      },
    },
  ];
};
