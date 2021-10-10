import type { Reducer } from "linki";
import { fork, link, map, passUndefined, pipe, reduce, wrap } from "linki";

import "./mult-select.css";
import type {
  Component,
  Slot,
  View,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { button, div, li, newSlot, ul } from "../../libs/simple-ui/render";

import { creatAutocomplete } from "./autocomplete";

const crossIcon =
  '<svg height="12px" aria-label="Remove category" class="octicon octicon-x" viewBox="0 0 16 16" width="12" role="img"><path fill-rule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"></path></svg>';

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
  autocompleteSlot: Slot;
  categoriesSlot: Slot;
  focusInput: () => void;
  extraClass?: string;
}> = ({
  autocompleteSlot,
  categoriesSlot,
  focusInput,
  extraClass = "p-0 mx-2",
}) => () =>
  div(
    {
      class:
        "multi-select form-control d-inline-flex color-bg-primary position-relative " +
        extraClass,
      onClick: focusInput,
    },
    categoriesSlot,
    autocompleteSlot
  );

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
  let currentCategories: string[] = [];
  const setCurrentCategories = (it: string[]): void => {
    currentCategories = it;
  };

  const search = (team: string): Promise<string[]> =>
    Promise.resolve(
      categories.filter(
        (it) => !currentCategories.includes(it) && it.includes(team)
      )
    );

  const [autocompleteSlot, { focus: focusInput }] = newSlot(
    "suggestions",
    creatAutocomplete({
      search,
      onSelected: (s) => {
        changeCategories(["add", s]);
      },
      onCreated: (s) => {
        changeCategories(["add", s]);
      },
      placeholder: "Add category",
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

  const changeCategories = fork(
    link(reduce(listReducer, []), fork(renderCategories, setCurrentCategories))
  );

  render(
    setupMultiSelect({
      autocompleteSlot,
      categoriesSlot,
      focusInput,
      extraClass,
    })()
  );

  return {};
};
