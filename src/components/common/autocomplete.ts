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
import {
  getInputTarget,
  getTarget,
  inputValue,
  selectInputTarget,
  trim,
} from "../../libs/simple-ui/utils/funtions";

export const createAutocompleteList: Component<
  { onSelected: (s: string) => void; onCreated: (s: string) => void },
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

  const renderList = fork<string[] | undefined>(
    link(map(to(undefined)), fork(setDom)),
    link(map(to(undefined)), setHighlighted),
    link(
      map((suggestions) => {
        if (suggestions === undefined) return undefined;
        if (suggestions.length > 0) return suggestionsView({ suggestions });
        return undefined;
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
  onTriggered: (value: string) => void;
  hideList: () => void;
  nextItem: () => void;
  previousItem: () => void;
  placeholder?: string;
}> = ({
  onInputDisplay,
  onSearch,
  placeholder = "",
  previousItem,
  nextItem,
  hideList,
  onTriggered,
}) => {
  const getTrimmedValue = map(getInputTarget, inputValue, trim);
  const trigger = link(getTrimmedValue, onTriggered);
  const keyHandlers: Map<string, (event: KeyboardEvent) => void> = new Map([
    ["Enter", trigger],
    ["Tab", trigger],
    ["Escape", hideList],
    ["ArrowDown", nextItem],
    ["ArrowUp", previousItem],
  ]);

  return () =>
    input({
      class:
        "form-control color-bg-primary shorter d-inline-block mx-1 p-0 border-0",
      type: "text",
      onDisplay: link(map(getInputTarget), onInputDisplay),
      onFocus: selectInputTarget,
      onKeydown: (event) => {
        const handler = keyHandlers.get(event.key);
        if (!handler) return;
        handler(event);
        event.stopPropagation();
        event.preventDefault();
      },
      onInput: link(getTrimmedValue, debounce(300), onSearch),
      onBlur: hideList,
      autocomplete: false,
      placeholder,
    });
};

export const creatAutocomplete: Component<
  {
    search: (term: string) => Promise<string[]>;
    onSelected: (selected: string) => void;
    onCreated: (created: string) => void;
    placeholder?: string;
  },
  { focus: void }
> = ({ search, onSelected, onCreated, placeholder }) => (render) => {
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
      onCreated: (item) => {
        hideList();
        controlInput("reset");
        onCreated(item);
      },
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
    onTriggered: selectHighlighted,
    hideList: hideList,
    nextItem: highlightNextItem,
    previousItem: highlightPreviousItem,
    placeholder,
  });

  render(div(input(), suggestionsSlot));

  return {
    focus: () => controlInput("focus"),
  };
};
