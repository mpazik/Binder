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
  split,
  to,
  valueWithState,
  withErrorLogging,
  withState,
} from "linki";
import type { JsonHtml, UiComponent, View } from "linki-ui";
import {
  div,
  dom,
  focusElement,
  getTargetInput,
  hasNoKeyModifier,
  input,
  isKey,
  li,
  mountComponent,
  preventDefault,
  renderJsonHtmlToDom,
  resetInput,
  selectTargetInput,
  setupView,
  small,
  span,
  ul,
} from "linki-ui";

import type { RecentDocuments } from "../../../functions/recent-document-serach";
import type { Uri } from "../../../libs/browser-providers";
import { isFocusedElementStatic } from "../../../libs/dom";
import { relativeDate } from "../../common/relative-date";
import { specialDirectoryUri } from "../special-uris";

// @ts-ignore
export const blur = (): void => document.activeElement?.blur();

const autoCompleteFrame: View<{
  setInteracting: () => void;
  footer?: JsonHtml;
  content: JsonHtml;
}> = ({ setInteracting, footer, content }) =>
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

const suggestionsView = <T>(): View<{
  suggestions: T[];
  onSelected: Callback<T>;
  getOptionLabel: (item: T) => JsonHtml;
}> => ({ suggestions, onSelected, getOptionLabel }) =>
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

export const autocompleteList = <T>(
  getOptionLabel: (item: T) => JsonHtml,
  footer?: JsonHtml
): UiComponent<
  {
    renderList: T[];
    hideList: void;
    highlightNextItem: void;
    highlightPreviousItem: void;
    selectHighlighted: void;
  },
  {
    onSelected: T;
  }
> => ({ onSelected, render }) => {
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

  const setupAutoCompleteFrame: View<{ content: JsonHtml }> = setupView(
    autoCompleteFrame,
    {
      setInteracting: () => setInteracting(true),
      footer,
    }
  );
  const setupSuggestionsView: View<{ suggestions: T[] }> = setupView(
    suggestionsView<T>(),
    {
      getOptionLabel,
      onSelected,
    }
  );

  const renderList = fork<T[] | undefined>(
    link(map(to(undefined)), fork(setDom)),
    link(map(to(undefined)), setHighlighted),
    link(
      map((suggestions) => {
        if (suggestions === undefined) return undefined;
        if (suggestions.length > 0) {
          const suggestionsDom = renderJsonHtmlToDom(
            setupSuggestionsView({ suggestions })
          ) as HTMLElement;
          setDom(suggestionsDom);
          return setupAutoCompleteFrame({ content: dom(suggestionsDom) });
        }
        return setupAutoCompleteFrame({ content: noItemsView() });
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
};

const toUrl = (s: string) => new URL(s);
const isUrl = (s: string): boolean => {
  try {
    toUrl(s);
    return true;
  } catch (e) {
    return false;
  }
};

const searchFocusShortCutKey = "Slash";

export const searchBox = (
  onSearch: (term: string) => Promise<RecentDocuments[]>
): UiComponent<
  { start: void; stop: void },
  {
    onSelected: Uri;
  }
> => ({ onSelected, render }) => {
  const selectUrl = (uri: Uri) => {
    hideList();
    resetSearchInput();
    onSelected(uri);
  };

  const goToDirectory = () => selectUrl(specialDirectoryUri);
  const [
    suggestionsSlot,
    {
      renderList,
      highlightPreviousItem,
      highlightNextItem,
      selectHighlighted,
      hideList,
    },
  ] = mountComponent(
    autocompleteList<RecentDocuments>(
      ({ name, startDate }) => {
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
      div(
        {
          class: "py-1 text-center autocomplete-item",
          onClick: goToDirectory,
        },
        "List all documents [Tab]"
      )
    ),
    {
      onSelected: link(
        map<RecentDocuments, Uri>((it) => it.uriWithFragment.uri),
        selectUrl
      ),
    }
  );

  const trigger = (): void => selectHighlighted();

  const keyHandlers: Map<string, (event: KeyboardEvent) => void> = new Map([
    ["Enter", trigger],
    ["Tab", goToDirectory],
    ["Escape", () => fork(hideList, blur)()],
    ["ArrowDown", () => highlightNextItem()],
    ["ArrowUp", () => highlightPreviousItem()],
  ]);

  const renderSearch = link(
    map(onSearch),
    withErrorLogging(async()),
    renderList
  );

  const inputElement = renderJsonHtmlToDom(
    input({
      class: "form-control width-full",
      type: "text",
      placeholder: `Search or open new url [ / ]`,
      onFocus: fork(selectTargetInput, () => {
        renderSearch("");
      }),
      onInput: link(
        map(getTargetInput, (input) => input.value.trim()),
        debounce(100),
        link(split<string>(isUrl), [selectUrl, renderSearch])
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

  render(
    div({ class: "position-relative" }, dom(inputElement), suggestionsSlot)
  );

  return {
    start: () => {
      document.addEventListener("keydown", keyHandler);
    },
    stop: () => {
      document.removeEventListener("keydown", keyHandler);
    },
  };
};
