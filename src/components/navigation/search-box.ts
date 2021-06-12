import {
  defined,
  definedTuple,
  filter,
  fork,
  is,
  link,
  map,
  split,
  to,
  valueWithState,
  withState,
} from "linki";

import { DirectoryRecord } from "../../functions/indexes/directory-index";
import { mapAwait } from "../../libs/connections/mappers";
import {
  Component,
  ComponentBody,
  div,
  input,
  li,
  newSlot,
  ul,
  View,
} from "../../libs/simple-ui/render";
import {
  getInputTarget,
  getTarget,
  resetInput,
  selectInputTarget,
} from "../../libs/simple-ui/utils/funtions";

const noItemsView: View = () =>
  div(
    {
      class: "autocomplete-results",
    },
    div({ class: "p-2" }, "No results")
  );

export const createAutocompleteList = <T>({
  onSelected,
  getOptionLabel,
}: {
  onSelected: (s: T) => void;
  getOptionLabel: (item: T) => string;
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

  const renderList = fork<T[] | undefined>(
    link(map(to(undefined)), fork(setDom)),
    link(map(to(undefined)), setHighlighted),
    link(
      map((suggestions) => {
        if (suggestions === undefined) return undefined;
        if (suggestions.length > 0) return suggestionsView({ suggestions });
        return noItemsView();
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

  const suggestionsView: View<{ suggestions: T[] }> = ({ suggestions }) =>
    ul(
      {
        class: "autocomplete-results",
        onDisplay: link(map(getTarget), setDom),
        onMousedown: link(map(to(true)), setInteracting),
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

type SearchBoxOption = {
  name: string;
  uri: string;
};

const recordToOption = (r: DirectoryRecord) => ({
  name: r.props.name,
  uri: r.hash,
});
const forAll = <T, S>(mapper: (v: T) => S): ((v: T[]) => S[]) => (values) =>
  values.map(mapper);

export const searchBox: Component<{
  onSearch: (term: string) => Promise<DirectoryRecord[]>;
  onSelected: (url: string) => void;
}> = ({ onSearch, onSelected }) => (render) => {
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
    createAutocompleteList<SearchBoxOption>({
      onSelected: (item) => {
        hideList();
        resetSearchInput();
        onSelected(item.uri);
      },
      getOptionLabel: (record) => record.name,
    })
  );

  const trigger = (): void => selectHighlighted();

  const keyHandlers: Map<string, (event: KeyboardEvent) => void> = new Map([
    ["Enter", trigger],
    ["Tab", trigger],
    ["Escape", () => hideList()],
    ["ArrowDown", () => highlightNextItem()],
    ["ArrowUp", () => highlightPreviousItem()],
  ]);

  const [resetSearchInput, setInputForReset] = link(
    withState<HTMLInputElement | undefined>(undefined),
    filter(defined),
    resetInput
  );

  render(
    div(
      { class: "position-relative" },
      input({
        onDisplay: link(map(getInputTarget), setInputForReset),
        class: "form-control width-full",
        type: "text",
        placeholder: "Search your collection or open new url",
        onFocus: selectInputTarget,
        onInput: link(
          map(getInputTarget, (input) => input.value.trim()),
          // debounce(300), // debounce actually make it feel slower and search take only few ms
          link(split(isUrl), [
            (url: string) =>
              renderList([
                { uri: url, name: `open page from: ${new URL(url).host}` },
              ]),
            mapAwait(
              onSearch,
              link(map(forAll(recordToOption)), renderList),
              (e) => console.error(e)
            ),
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
