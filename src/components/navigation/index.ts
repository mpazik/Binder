import { link, map, asyncMapWithErrorHandler } from "linki";

import {
  DirectoryIndex,
  DirectoryRecord,
} from "../../functions/indexes/directory-index";
import { Callback } from "../../libs/connections";
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
  const renderNavigation: Callback<HashUri | undefined> = link(
    asyncMapWithErrorHandler(
      (hashUri) =>
        directoryIndex({}).then((list) => ({ list, current: hashUri })),
      (e) => console.error(e)
    ),
    map(fileNavigationList),
    render
  );

  renderNavigation(undefined);

  return {
    selectItem: renderNavigation,
  };
};
