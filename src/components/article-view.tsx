import React, { useCallback } from "react";

import { Article, URL } from "schema-dts";

import { ArticleContentFetcher } from "../functions/article-content-fetcher";
import { ArticleLdFetcher } from "../functions/article-ld-fetcher";
import { linkHijackToQueryParams } from "../functions/url-hijack";
import { findUri, LinkedDataWithItsHash } from "../utils/linked-data";
import { useProvider } from "../utils/react";

import { AsyncLoader } from "./async-loader";

const ArticleViewIn: React.FC<{
  article: Article;
  contentFetcher: ArticleContentFetcher;
}> = ({ contentFetcher, article }) => {
  const uri = findUri(article);
  return (
    <AsyncLoader
      promise={useCallback(() => contentFetcher(article), [
        contentFetcher,
        article,
      ])}
    >
      {(content: Document) => (
        <div id="content" className="mb-3 markdown-body">
          <div className="Subhead">
            <div className="Subhead-heading">{article.name}</div>
            {uri && (
              <div className="Subhead-description">
                From: <a href={uri}>{new URL(uri).hostname}</a>
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

export const ArticleView: React.FC<{
  articleLdFetcher: ArticleLdFetcher;
  contentFetcher: ArticleContentFetcher;
  onArticleLoaded?: (article: LinkedDataWithItsHash<Article>) => void;
}> = ({
  contentFetcher,
  articleLdFetcher,
  onArticleLoaded = () => {
    // do nothing.
  },
}) => {
  const queryParams = useProvider(
    linkHijackToQueryParams,
    new URLSearchParams(window.location.search)
  );
  const uri =
    queryParams.get("uri") || "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu";

  return (
    <AsyncLoader
      promise={useCallback(() => articleLdFetcher(uri), [
        articleLdFetcher,
        uri,
      ])}
    >
      {(article: LinkedDataWithItsHash<Article>) => {
        onArticleLoaded(article);
        return (
          <ArticleViewIn article={article.ld} contentFetcher={contentFetcher} />
        );
      }}
    </AsyncLoader>
  );
};
