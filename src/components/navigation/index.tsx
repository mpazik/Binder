import React from "react";

import { HashName } from "../../utils/hash";
import { LinkedDataWithHash } from "../../utils/linked-data";

export const Navigation: React.FC<{
  list: LinkedDataWithHash[];
  current?: HashName;
}> = ({ list, current }) => {
  return (
    <nav className="menu">
      {list.map(({ ld, hash }) => (
        <a
          className="menu-item"
          href={hash}
          aria-current={hash === current ? "page" : undefined}
        >
          {ld.name}
        </a>
      ))}
      {list.map(({ ld, hash }) => (
        <a className="menu-item" href={hash}>
          {ld.name}
        </a>
      ))}
    </nav>
  );
};
