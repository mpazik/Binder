import {
  and,
  async,
  Callback,
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

import { RecentDocuments } from "../../functions/recent-document-serach";
import {
  newUriWithFragment,
  UriWithFragment,
} from "../../functions/url-hijack";
import {
  Component,
  ComponentBody,
  div,
  input,
  JsonHtml,
  li,
  newSlot,
  small,
  span,
  ul,
  View,
  ViewSetup,
} from "../../libs/simple-ui/render";
import {
  focusElement,
  getInputTarget,
  getTarget,
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
      onMousedown: link(map(to(true)), setInteracting),
      style: {
        "overflow-y": "hidden",
      },
    },
    content,
    ...(footer ? [footer] : [])
  );

const setupSuggestionsView = <T>({
  setDom,
  onSelected,
  getOptionLabel,
}: {
  setDom: Callback<HTMLElement>;
  onSelected: Callback<T>;
  getOptionLabel: (item: T) => JsonHtml;
}): View<{ suggestions: T[] }> => ({ suggestions }) =>
  ul(
    {
      onDisplay: link(map(getTarget), setDom),
      style: {
        "overflow-y": "auto",
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

export const createAutocompleteList = <T>({
  onSelected,
  getOptionLabel,
  footer,
}: {
  onSelected: (s: T) => void;
  getOptionLabel: (item: T) => JsonHtml;
  footer?: JsonHtml;
}): ComponentBody<{
  renderList: T[];
  hideList: void;
  highlightNextItem: void;
  highlightPreviousItem: void;
  selectHighlighted: void;
}> => (render) => {
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
    setDom,
    getOptionLabel,
    onSelected,
  });

  const renderList = fork<T[] | undefined>(
    link(map(to(undefined)), fork(setDom)),
    link(map(to(undefined)), setHighlighted),
    link(
      map((suggestions) => {
        if (suggestions === undefined) return undefined;
        if (suggestions.length > 0)
          return autoCompleteFrame(suggestionsView({ suggestions }));
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
};

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

export const searchBox: Component<{
  onSearch: (term: string) => Promise<RecentDocuments[]>;
  onSelected: (url: UriWithFragment) => void;
}> = ({ onSearch, onSelected }) => (render, onClose) => {
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
  ] = newSlot(
    "autocomplete-list",
    createAutocompleteList<RecentDocuments>({
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
          class: "py-1 color-text-secondary text-center autocomplete-item",
          onClick: goToDirectory,
        },
        "List all documents [Tab]"
      ),
    })
  );
  const trigger = (): void => selectHighlighted();

  const keyHandlers: Map<string, (event: KeyboardEvent) => void> = new Map([
    ["Enter", trigger],
    ["Tab", goToDirectory],
    ["Escape", () => fork(hideList, blur)()],
    ["ArrowDown", () => highlightNextItem()],
    ["ArrowUp", () => highlightPreviousItem()],
  ]);

  const [resetSearchInput, setInputForReset] = link(
    withState<HTMLInputElement | undefined>(undefined),
    filter(defined),
    resetInput
  );

  const [focusInput, setInputForFocus] = link(
    withState<HTMLInputElement | undefined>(undefined),
    filter(defined),
    focusElement
  );

  const renderSearch = link(map(onSearch), async(), [
    renderList,
    (e) => console.error(e),
  ]);

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

  onClose(() => {
    document.removeEventListener("keydown", keyHandler);
  });
  document.addEventListener("keydown", keyHandler);

  render(
    div(
      { class: "position-relative" },
      input({
        onDisplay: link(
          map(getInputTarget),
          fork(setInputForReset, setInputForFocus)
        ),
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
        onBlur: hideList,
        onKeydown: (event) => {
          const handler = keyHandlers.get(event.key);
          if (!handler) return;
          handler(event);
          event.stopPropagation();
          event.preventDefault();
        },
      }),
      suggestionsSlot
    )
  );
};
