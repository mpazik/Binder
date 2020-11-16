import React, { useEffect } from "react";

import { Article, URL } from "schema-dts";

import { ArticleContentFetcher } from "../functions/article-content-fetcher";
import { ArticleLdFetcher } from "../functions/article-ld-fetcher";
import { ArticleContent } from "../functions/article-processor";
import { linkHijackToQueryParams } from "../functions/url-hijack";
import { findUri, LinkedDataWithItsHash } from "../utils/linked-data";
import { newStateMapper, stateMachine } from "../utils/named-state";
import { useProcessor, useProvider } from "../utils/react";

import { CenterLoading } from "./common/center-loading";

type ArticleViewAction = ["loading"] | ["loaded", ArticleContent];

export type ArticleViewState =
  | ["initializing"]
  | ["loaded", ArticleContent]
  | ["loading", { existingArticle: ArticleContent }];

const articleViewInitState: ArticleViewState = ["initializing"];
const articleViewStateMachine = stateMachine<
  ArticleViewState,
  ArticleViewAction
>(articleViewInitState, {
  initializing: {
    loaded: (articleContent) => ["loaded", articleContent],
    loading: () => ["initializing"], // ignore loading action
  },
  loading: {
    loaded: (articleContent) => ["loaded", articleContent],
  },
  loaded: {
    loading: (_, existingArticle) => ["loading", { existingArticle }],
  },
});

const ArticleView: React.FC<ArticleContent> = ({ content, linkedData }) => {
  const uri = findUri(linkedData);
  return (
    <div id="content" className="mb-3 markdown-body">
      <div className="Subhead">
        <div className="Subhead-heading">{linkedData.name}</div>
        <div className="Subhead-description">
          {uri && (
            <span>
              From: <a href={uri}>{new URL(uri).hostname}</a>
            </span>
          )}
        </div>
      </div>
      <article dangerouslySetInnerHTML={{ __html: content.body.innerHTML }} />
    </div>
  );
};

const stateMapperToView = newStateMapper<
  ArticleViewState,
  ReturnType<React.FC>
>({
  initializing: () => <CenterLoading />,
  loading: ({ existingArticle }) => (
    <React.Fragment>
      <CenterLoading />
      <ArticleView {...existingArticle} />
    </React.Fragment>
  ),
  loaded: (content) => <ArticleView {...content} />,
});

const useArticleContentProvider = ({
  articleLdFetcher,
  contentFetcher,
  onArticleLoaded,
}: {
  articleLdFetcher: ArticleLdFetcher;
  contentFetcher: ArticleContentFetcher;
  onArticleLoaded: (article: LinkedDataWithItsHash<Article>) => void;
}): ArticleViewState => {
  const queryParams = useProvider(
    linkHijackToQueryParams,
    new URLSearchParams(window.location.search)
  );
  const uri =
    queryParams.get("uri") || "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu";

  const [articleViewState, setArticleViewAction] = useProcessor(
    articleViewStateMachine,
    articleViewInitState
  );

  useEffect(() => {
    const controller = new AbortController();
    setArticleViewAction(["loading"]);
    (async function anyNameFunction() {
      const article = await articleLdFetcher(uri, controller.signal);
      onArticleLoaded(article);
      const content = await contentFetcher(article.ld);
      setArticleViewAction(["loaded", { content, linkedData: article.ld }]);
    })();

    return () => {
      controller.abort();
    };
  }, [
    setArticleViewAction,
    articleLdFetcher,
    contentFetcher,
    onArticleLoaded,
    uri,
  ]);

  return articleViewState;
};

export const ArticleComponent: React.FC<{
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
  const articleViewState = useArticleContentProvider({
    onArticleLoaded,
    contentFetcher,
    articleLdFetcher,
  });

  return stateMapperToView(articleViewState);
};
