import React, { useCallback } from "react";

import { isHashUri } from "../utils/hash";
import { LinkedData } from "../utils/linked-data";

import { AsyncLoader } from "./async-loader";

export const fetchArticle = async (ld: LinkedData): Promise<string> =>
  (await fetch(`./${ld.name}.html`)).text();

const findUrl = (ld: LinkedData): string | undefined =>
  ld.url.find((it) => !isHashUri(it));

export const Article: React.FC<{ ld: LinkedData }> = ({ ld }) => {
  const url = findUrl(ld);
  return (
    <AsyncLoader promise={useCallback(() => fetchArticle(ld), [ld])}>
      {(article) => (
        <div id="content" className="mb-3 markdown-body">
          <div className="Subhead">
            <div className="Subhead-heading">{ld.name}</div>
            {url && (
              <div className="Subhead-description">
                From: <a href={url}>{new URL(url).hostname}</a>
              </div>
            )}
          </div>
          <article dangerouslySetInnerHTML={{ __html: article }} />
        </div>
      )}
    </AsyncLoader>
  );
};
