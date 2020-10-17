import React from "react";

import { DirectoryRecord } from "../../functions/indexes/directory-index";
import { HashName, hashNameToHashUri } from "../../utils/hash";

export const Navigation: React.FC<{
  list: DirectoryRecord[];
  current?: HashName;
}> = ({ list, current }) => {
  return (
    <nav className="menu">
      {list.map(({ props: { name }, hash }) => (
        <a
          key={hash}
          className="menu-item"
          href={hashNameToHashUri(hash)}
          aria-current={hash === current ? "page" : undefined}
        >
          {name}
        </a>
      ))}
    </nav>
  );
};
