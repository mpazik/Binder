import {
  DirectoryIndex,
  DirectoryRecord,
} from "../../functions/indexes/directory-index";
import { Callback } from "../../libs/connections";
import {
  extendAsync,
  map,
  mapAwait,
  pipe,
  toObject,
} from "../../libs/connections/mappers";
import { HashUri } from "../../libs/hash";
import { a, Component, View } from "../../libs/simple-ui/render";

const fileNavigationList: View<{
  list: DirectoryRecord[];
  current?: HashUri;
}> = ({ list, current }) => [
  "nav",
  { class: "menu" },
  ...list.map(({ props: { name }, hash }) =>
    a(
      {
        class: "menu-item",
        href: hash,
        ...(hash === current ? { "aria-current": "page" } : {}),
      },
      name
    )
  ),
];

export const fileNavigation: Component<
  {
    directoryIndex: DirectoryIndex;
  },
  { selectItem: HashUri | undefined }
> = ({ directoryIndex }) => (render) => {
  const renderNavigation: Callback<HashUri | undefined> = mapAwait(
    extendAsync(() => directoryIndex({})),
    map(pipe(toObject("current", "list"), fileNavigationList), render),
    (e) => console.error(e)
  );
  renderNavigation(undefined);

  return {
    selectItem: renderNavigation,
  };
};
