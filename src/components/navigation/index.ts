import {
  DirectoryIndex,
  DirectoryRecord,
} from "../../functions/indexes/directory-index";
import { HashName, hashNameToHashUri } from "../../libs/hash";
import { a, classList, Component, View } from "../../libs/simple-ui/render";
import { asyncLoader } from "../common/async-loader";

const fileNavigationList: View<{
  list: DirectoryRecord[];
  current?: HashName;
}> = ({ list, current }) => [
  "nav",
  { class: "menu" },
  ...list.map(({ props: { name }, hash }) =>
    a(
      {
        class: classList({ "menu-item": true, current: hash === current }),
        href: hashNameToHashUri(hash),
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
    asyncLoader(directoryIndex({}), (list) => (render) => {
      render(fileNavigationList({ list, current: hash }));
    })(render, onClose);
  };
  hashProvider(handlerHash);
  handlerHash();
};
