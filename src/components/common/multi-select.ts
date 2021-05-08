import {
  definedTuple,
  filter,
  fork,
  ignoreParam,
  link,
  map,
  passUndefined,
  pipe,
  reduce,
  Reducer,
  to,
  valueWithState,
  withState,
  wrap,
} from "linki";

import "./mult-select.css";

import { debounce, is } from "../../../../linki/src";
import {
  button,
  Component,
  div,
  input,
  li,
  newSlot,
  Slot,
  ul,
  View,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { getInputTarget, getTarget } from "../../libs/simple-ui/utils/funtions";

const crossIcon =
  '<svg height="12px" aria-label="Remove category" class="octicon octicon-x" viewBox="0 0 16 16" width="12" role="img"><path fill-rule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"></path></svg>';

const suggestionsComp: Component<
  { onSuggestionSelected: (s: string) => void },
  {
    renderSuggestions: string[];
    hideSuggestions: void;
    nextSuggestion: void;
    previousSuggestion: void;
    sendSuggestion: string;
  }
> = ({ onSuggestionSelected }) => (render) => {
  const [sendSuggestion, setSelected] = link(
    valueWithState<string | undefined, string>(undefined),
    ([selected, search]) => onSuggestionSelected(selected ?? search)
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
        setSelected((newSelected as HTMLElement).innerText);
        newSelected.setAttribute("aria-selected", "true");
      }
    }
  );

  const [hideSuggestionsInternal, setInteracting] = link(
    withState(false),
    filter(is(false)),
    link(map(to(undefined)), render)
  );
  const hideSuggestions = fork(
    hideSuggestionsInternal,
    link(map(to(false)), setInteracting)
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
            onClick: link(map(to(suggestion)), onSuggestionSelected),
          },
          suggestion
        )
      )
    );

  return {
    renderSuggestions: fork(
      link(
        map((suggestions) => {
          if (suggestions.length > 0) return suggestionsView({ suggestions });
          return undefined;
        }),
        render
      ),
      link(map(to(undefined)), fork(setDom)),
      link(map(to(undefined)), setSelected)
    ),
    hideSuggestions: hideSuggestions,
    nextSuggestion: () => move("next"),
    previousSuggestion: () => move("previous"),
    sendSuggestion,
  };
};

const categoriesComp: Component<
  { onCategoryRemoved: (category: string) => void },
  {
    renderCategories: string[] | undefined;
  }
> = ({ onCategoryRemoved }) => (render) => {
  const categoryView: View<{ categories: string[] }> = ({ categories }) =>
    ul(
      { class: "multi-select-selected d-inline" },
      ...categories.map((category) =>
        li(
          category,
          button({
            onClick: () => onCategoryRemoved(category),
            dangerouslySetInnerHTML: crossIcon,
          })
        )
      )
    );

  return {
    renderCategories: fork(
      link(map(passUndefined(pipe(wrap("categories"), categoryView))), render)
    ),
  };
};

export const setupMultiSelect: ViewSetup<{
  suggestionsSlot: Slot;
  categoriesSlot: Slot;
  onInputDisplay: (input: HTMLInputElement) => void;
  onSearch: (text: string) => void;
  onCategoryAdded: (category: string) => void;
  hideSuggestions: () => void;
  nextSuggestion: () => void;
  previousSuggestion: () => void;
  focusInput: () => void;
  placeholder?: string;
  extraClass?: string;
}> = ({
  suggestionsSlot,
  categoriesSlot,
  onInputDisplay,
  onCategoryAdded,
  onSearch,
  hideSuggestions,
  nextSuggestion,
  previousSuggestion,
  focusInput,
  placeholder,
  extraClass = "p-0 mx-2",
}) => () => {
  // noinspection JSUnusedGlobalSymbols
  return div(
    {
      class:
        "multi-select form-control d-inline-block color-bg-primary position-relative " +
        extraClass,
      onClick: focusInput,
    },
    categoriesSlot,
    input({
      class:
        "form-control color-bg-primary shorter d-inline-block mx-1 p-0 border-0",
      onDisplay: link(map(getInputTarget), onInputDisplay),
      onKeydown: (event) => {
        if (event.key === "Enter" || event.key === "Tab") {
          const input = event.target as HTMLInputElement;
          onCategoryAdded(input.value.trim());
          event.stopPropagation();
          event.preventDefault();
        } else if (event.key === "Escape") {
          hideSuggestions();
          event.stopPropagation();
          event.preventDefault();
        } else if (event.key === "ArrowDown") {
          nextSuggestion();
          event.stopPropagation();
          event.preventDefault();
        } else if (event.key === "ArrowUp") {
          previousSuggestion();
          event.stopPropagation();
          event.preventDefault();
        }
      },
      onInput: link(
        map(getInputTarget, (input) => input.value.trim()),
        debounce(300),
        onSearch
      ),
      onBlur: hideSuggestions,
      autocomplete: false,
      placeholder,
    }),
    suggestionsSlot
  );
};
type Actions<T> = ["add", T] | ["remove", T];

const listReducer: Reducer<string[], Actions<string>> = (
  state,
  [type, value]
) => {
  if (type === "add") {
    return state.concat([value]);
  } else {
    state.splice(state.indexOf(value), 1);
    return state;
  }
};

export const multiSelect: Component<{ extraClass?: string }, {}> = ({
  extraClass,
}) => (render) => {
  const categories = ["food", "tool", "animal", "tiger", "cloth"];

  const [
    suggestionsSlot,
    {
      renderSuggestions,
      previousSuggestion,
      nextSuggestion,
      sendSuggestion,
      hideSuggestions,
    },
  ] = newSlot(
    "suggestions",
    suggestionsComp({
      onSuggestionSelected: (s) => {
        changeCategories(["add", s]);
      },
    })
  );

  const [categoriesSlot, { renderCategories }] = newSlot(
    "categories",
    categoriesComp({
      onCategoryRemoved: (s) => {
        changeCategories(["remove", s]);
      },
    })
  );

  const [search, setCurrentCategories] = link(
    valueWithState<string[], string>([]),
    map(([state, search]) =>
      categories.filter((it) => !state.includes(it) && it.includes(search))
    ),
    renderSuggestions
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

  const changeCategories = fork(
    link(
      filter(([type]: Actions<string>) => type === "add"),
      ignoreParam(),
      fork(() => controlInput("reset"), hideSuggestions)
    ),
    link(reduce(listReducer, []), fork(renderCategories, setCurrentCategories))
  );

  render(
    setupMultiSelect({
      onInputDisplay: setInput,
      onSearch: search,
      suggestionsSlot,
      categoriesSlot,
      onCategoryAdded: sendSuggestion,
      hideSuggestions,
      nextSuggestion,
      previousSuggestion,
      focusInput: () => controlInput("focus"),
      placeholder: "add category",
      extraClass,
    })()
  );

  return {};
};
