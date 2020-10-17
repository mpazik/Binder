import React, { useCallback } from "react";

import { Article, URL } from "schema-dts";

import { ArticleContentFetcher } from "../functions/article-content-fetcher";
import { findUri } from "../utils/linked-data";

import { AsyncLoader } from "./async-loader";

export const ArticleView: React.FC<{
  article: Article;
  contentFetcher: ArticleContentFetcher;
}> = ({ article, contentFetcher }) => {
  const url = findUri(article);
  return (
    <AsyncLoader
      promise={useCallback(() => contentFetcher(article), [
        contentFetcher,
        article,
      ])}
    >
      {(content) => (
        <div id="content" className="mb-3 markdown-body">
          <div className="Subhead">
            <div className="Subhead-heading">{article.name}</div>
            {url && (
              <div className="Subhead-description">
                From: <a href={url}>{new URL(url).hostname}</a>
              </div>
            )}
          </div>
          <article
            dangerouslySetInnerHTML={{ __html: content.body.innerHTML }}
          />
        </div>
      )}
    </AsyncLoader>
  );
};
