import type { Callback } from "linki";
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
import type { UiComponent, View } from "linki-ui";
import {
  dom,
  getTargetInput,
  input,
  inputValue,
  li,
  mountComponent,
  renderJsonHtmlToDom,
  selectTargetInput,
  trim,
  ul,
} from "linki-ui";

const suggestionsView: View<{
  setInteracting: Callback<boolean>;
  onSelected: Callback<string>;
  suggestions: string[];
}> = ({ suggestions, setInteracting, onSelected }) =>
  ul(
    {
      class: "autocomplete-results",
      onMouseDown: link(map(to(true)), setInteracting),
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

export const createAutocompleteList: UiComponent<
  {
    renderList: string[];
    hideList: void;
    highlightNextItem: void;
    highlightPreviousItem: void;
    selectHighlighted: string;
  },
  { onSelected: string; onCreated: string }
> = ({ onSelected, onCreated, render }) => {
  const [selectHighlighted, setHighlighted] = link(
    valueWithState<string | undefined, string>(undefined),
    ([highlighted, inputValue]) => {
      if (highlighted) {
        onSelected(highlighted);
      } else {
        onCreated(inputValue);
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

  const renderList: Callback<string[] | undefined> = fork<string[] | undefined>(
    link(map(to(undefined)), setHighlighted),
    link(
      map((suggestions) => {
        if (suggestions === undefined || suggestions.length === 0) {
          setDom(undefined);
          return undefined;
        }
        const suggestionsViewDom = renderJsonHtmlToDom(
          suggestionsView({
            suggestions,
            setInteracting,
            onSelected,
          })
        ) as HTMLElement;
        setDom(suggestionsViewDom);
        return dom(suggestionsViewDom);
      }),
      render
    )
  );

  const [hideList, setInteracting] = link(
    withState<boolean>(false),
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

export const autocompleteInput: View<{
  onSearch: (text: string) => void;
  onTriggered: (value: string) => void;
  hideList: () => void;
  nextItem: () => void;
  previousItem: () => void;
  placeholder?: string;
}> = ({
  onSearch,
  placeholder = "",
  previousItem,
  nextItem,
  hideList,
  onTriggered,
}) => {
  const getTrimmedValue = map(getTargetInput, inputValue, trim);
  const trigger = link(getTrimmedValue, onTriggered);
  const keyHandlers: Map<string, (event: KeyboardEvent) => void> = new Map([
    ["Enter", trigger],
    ["Tab", trigger],
    ["Escape", hideList],
    ["ArrowDown", nextItem],
    ["ArrowUp", previousItem],
  ]);

  return input({
    class:
      "form-control color-bg-primary shorter d-inline-block mx-1 p-0 border-0",
    type: "text",
    onFocus: selectTargetInput,
    onKeyDown: (event) => {
      const handler = keyHandlers.get(event.key);
      if (!handler) return;
      handler(event);
      event.stopPropagation();
      event.preventDefault();
    },
    onInput: link(getTrimmedValue, debounce(300), onSearch),
    onBlur: hideList,
    autocomplete: "false",
    placeholder,
  });
};

export const createAutocomplete = ({
  placeholder,
  search,
}: {
  placeholder?: string;
  search: (term: string) => Promise<string[]>;
}): UiComponent<
  { focus: void },
  {
    onSelected: string;
    onCreated: string;
  }
> => ({ onSelected, onCreated, render }) => {
  const [
    suggestionsSlot,
    {
      renderList,
      highlightPreviousItem,
      highlightNextItem,
      selectHighlighted,
      hideList,
    },
  ] = mountComponent(createAutocompleteList, {
    onSelected: (item) => {
      hideList();
      inputDom.value = "";
      onSelected(item);
    },
    onCreated: (item) => {
      hideList();
      inputDom.value = "";
      onCreated(item);
    },
  });

  const inputDom = renderJsonHtmlToDom(
    autocompleteInput({
      onSearch: (term) =>
        search(term)
          // todo handle loading state and stop searching
          .then((result) => renderList(result)),
      onTriggered: selectHighlighted,
      hideList: hideList,
      nextItem: highlightNextItem,
      previousItem: highlightPreviousItem,
      placeholder,
    })
  ) as HTMLInputElement;

  render([dom(inputDom), suggestionsSlot]);

  return {
    focus: () => inputDom.focus(),
  };
};
