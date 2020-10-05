import React, { useCallback } from "react";

import { LinkedData } from "../utils/linked-data";

import { AsyncLoader } from "./async-loader";

export const fetchArticle = async (ld: LinkedData): Promise<string> =>
  (await fetch(`./${ld.name}.html`)).text();

export const Article: React.FC<{ ld: LinkedData }> = ({ ld }) => {
  return (
    <AsyncLoader promise={useCallback(() => fetchArticle(ld), [ld])}>
      {(article) => (
        <div id="content" className="mx-auto mb-3 f3">
          <h1>{ld.name}</h1>
          <article dangerouslySetInnerHTML={{ __html: article }} />
        </div>
      )}
    </AsyncLoader>
  );
};
