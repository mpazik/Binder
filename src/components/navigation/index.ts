import {
  DirectoryIndex,
  DirectoryRecord,
} from "../../functions/indexes/directory-index";
import { Provider } from "../../libs/connections";
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

export const fileNavigation: Component<{
  selectedItemProvider: Provider<HashUri | undefined>;
  directoryIndex: DirectoryIndex;
}> = ({ directoryIndex, selectedItemProvider }) => (render) => {
  const renderNavigation = (current?: HashUri) => {
    directoryIndex({}).then((list) =>
      render(fileNavigationList({ list, current }))
    );
  };
  selectedItemProvider(renderNavigation);
  renderNavigation();
};
