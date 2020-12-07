import {
  DirectoryIndex,
  DirectoryRecord,
} from "../../functions/indexes/directory-index";
import { HashName, hashNameToHashUri } from "../../libs/hash";
import { a, Component, View } from "../../libs/simple-ui/render";

const fileNavigationList: View<{
  list: DirectoryRecord[];
  current?: HashName;
}> = ({ list, current }) => [
  "nav",
  { class: "menu" },
  ...list.map(({ props: { name }, hash }) =>
    a(
      {
        class: "menu-item",
        href: hashNameToHashUri(hash),
        ...(hash === current ? { "aria-current": "page" } : {}),
      },
      name
    )
  ),
];

export const fileNavigation: Component<{
  hashProvider: (handler: (hash: HashName) => void) => void;
  directoryIndex: DirectoryIndex;
}> = ({ directoryIndex, hashProvider }) => (render, onClose) => {
  const handlerHash = (hash?: HashName) => {
    directoryIndex({}).then((list) =>
      render(fileNavigationList({ list, current: hash }))
    );
  };
  hashProvider(handlerHash);
  handlerHash();
};
