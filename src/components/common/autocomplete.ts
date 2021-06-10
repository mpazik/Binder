import {
  debounce,
  definedTuple,
  filter,
  fork,
  is,
  link,
  map,
  to,
  valueWithState,
  withState,
} from "linki";

import {
  Component,
  div,
  input,
  li,
  newSlot,
  ul,
  View,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { getInputTarget, getTarget } from "../../libs/simple-ui/utils/funtions";

const noItemsView: View = () =>
  div(
    {
      class: "autocomplete-results",
    },
    div({ class: "p-2" }, "No options")
  );

export const createAutocompleteList: Component<
  { onSelected: (s: string) => void; onCreated?: (s: string) => void },
  {
    renderList: string[];
    hideList: void;
    highlightNextItem: void;
    highlightPreviousItem: void;
    selectHighlighted: string;
  }
> = ({ onSelected, onCreated }) => (render) => {
  const [selectHighlighted, setHighlighted] = link(
    valueWithState<string | undefined, string>(undefined),
    ([highlighted, search]) => {
      if (highlighted) {
        onSelected(highlighted);
      } else if (onCreated) {
        onCreated(search);
      }
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
        setHighlighted((newSelected as HTMLElement).innerText);
        newSelected.setAttribute("aria-selected", "true");
      }
    }
  );

  const renderList = fork<string[] | undefined>(
    link(map(to(undefined)), fork(setDom)),
    link(map(to(undefined)), setHighlighted),
    link(
      map((suggestions) => {
        if (suggestions === undefined) return undefined;
        if (suggestions.length > 0) return suggestionsView({ suggestions });
        if (onCreated) return undefined;
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

  const suggestionsView: View<{ suggestions: string[] }> = ({ suggestions }) =>
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
          suggestion
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

export const createAutocompleteInput: ViewSetup<{
  onInputDisplay: (input: HTMLInputElement) => void;
  onSearch: (text: string) => void;
  onCategoryAdded: (category: string) => void;
  hideSuggestions: () => void;
  nextSuggestion: () => void;
  previousSuggestion: () => void;
  placeholder?: string;
}> = ({
  onInputDisplay,
  onSearch,
  placeholder,
  previousSuggestion,
  nextSuggestion,
  hideSuggestions,
  onCategoryAdded,
}) => {
  const addCategory = (event: KeyboardEvent) =>
    onCategoryAdded((event.target as HTMLInputElement).value.trim());

  const keyHandlers: Map<string, (event: KeyboardEvent) => void> = new Map([
    ["Enter", addCategory],
    ["Tab", addCategory],
    ["Escape", hideSuggestions],
    ["ArrowDown", nextSuggestion],
    ["ArrowUp", previousSuggestion],
  ]);

  return () =>
    input({
      class:
        "form-control color-bg-primary shorter d-inline-block mx-1 p-0 border-0",
      onDisplay: link(map(getInputTarget), onInputDisplay),
      onKeydown: (event) => {
        const handler = keyHandlers.get(event.key);
        if (!handler) return;
        handler(event);
        event.stopPropagation();
        event.preventDefault();
      },
      onInput: link(
        map(getInputTarget, (input) => input.value.trim()),
        debounce(300),
        onSearch
      ),
      onBlur: hideSuggestions,
      autocomplete: false,
      placeholder,
    });
};

export const creatAutocomplete: Component<
  {
    search: (term: string) => Promise<string[]>;
    onSelected: (selected: string) => void;
    onCreated?: (created: string) => void;
  },
  { focus: void }
> = ({ search, onSelected, onCreated }) => (render) => {
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
    createAutocompleteList({
      onSelected: (item) => {
        hideList();
        controlInput("reset");
        onSelected(item);
      },
      onCreated: onCreated
        ? (item) => {
            hideList();
            controlInput("reset");
            onCreated(item);
          }
        : undefined,
    })
  );

  const [controlInput, setInput] = link(
    valueWithState<HTMLInputElement | undefined, "focus" | "reset">(undefined),
    filter(definedTuple),
    ([input, action]) => {
      if (action === "reset") {
        input.value = "";
      }
      input.focus();
    }
  );

  const input = createAutocompleteInput({
    onInputDisplay: setInput,
    onSearch: (term) =>
      search(term)
        // todo handle loading state and stop searching
        .then((result) => renderList(result)),
    onCategoryAdded: selectHighlighted,
    hideSuggestions: hideList,
    nextSuggestion: highlightNextItem,
    previousSuggestion: highlightPreviousItem,
    placeholder: "add category",
  });

  render(div(input(), suggestionsSlot));

  return {
    focus: () => controlInput("focus"),
  };
};
