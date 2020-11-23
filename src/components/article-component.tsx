import React, { useCallback, useEffect } from "react";

import { Article, URL } from "schema-dts";

import { ArticleContentFetcher } from "../functions/article-content-fetcher";
import { ArticleLdFetcher } from "../functions/article-ld-fetcher";
import { ArticleContent } from "../functions/article-processor";
import { linkHijackToQueryParams } from "../functions/url-hijack";
import { CancelableProcessor, Consumer, map } from "../utils/connections";
import { findUri, LinkedDataWithItsHash } from "../utils/linked-data";
import { newStateMapper, stateMachineWithFeedback } from "../utils/named-state";
import { useCancelableProcessor } from "../utils/react";

import { CenterLoading } from "./common/center-loading";

type RetryAction = ["retry"];
type ArticleViewAction =
  | ["loading", URL]
  | ["loadedLinkedData", LinkedDataWithItsHash<Article>]
  | ["loadedContent", Document]
  | ["fail", string]
  | RetryAction;

export type ArticleViewState =
  | ["idle"]
  | ["initializing", URL]
  | ["initializingContent", LinkedDataWithItsHash<Article>]
  | ["loaded", ArticleContent]
  | ["loading", { existingArticle: ArticleContent; newUrl: URL }]
  | [
      "loadingContent",
      {
        newUrl: URL;
        newArticleLdWithHash: LinkedDataWithItsHash<Article>;
        existingArticle: ArticleContent;
      }
    ]
  | ["error", { reason: string; url: URL }];
const articleViewInitState: ArticleViewState = ["idle"];

const newArticleViewStateMachine = ({
  articleLdFetcher,
  contentFetcher,
}: {
  articleLdFetcher: ArticleLdFetcher;
  contentFetcher: ArticleContentFetcher;
}) =>
  stateMachineWithFeedback<ArticleViewState, ArticleViewAction>(
    articleViewInitState,
    {
      idle: {
        loading: (url) => ["initializing", url],
      },
      initializing: {
        loadedLinkedData: (articleWithHash) => [
          "initializingContent",
          articleWithHash,
        ],
        fail: (reason, url) => ["error", { reason, url }],
      },
      initializingContent: {
        loadedContent: (content, ldWithHash) => [
          "loaded",
          { content, linkedData: ldWithHash.ld },
        ],
      },
      loaded: {
        loading: (url, existingArticle) => [
          "loading",
          { existingArticle, newUrl: url },
        ],
      },
      loading: {
        loadedLinkedData: (articleWithHash, { existingArticle, newUrl }) => [
          "loadingContent",
          { newArticleLdWithHash: articleWithHash, existingArticle, newUrl },
        ],
        loading: (url, { existingArticle }) => [
          "loading",
          { existingArticle, newUrl: url },
        ],
        fail: (reason, { newUrl }) => ["error", { reason, url: newUrl }],
      },
      loadingContent: {
        loadedContent: (content, { newArticleLdWithHash }) => [
          "loaded",
          { content, linkedData: newArticleLdWithHash.ld },
        ],
        loading: (url, { existingArticle }) => [
          "loading",
          { existingArticle, newUrl: url },
        ],
        fail: (reason, { newUrl }) => ["error", { reason, url: newUrl }],
      },
      error: {
        retry: (_, { url }) => ["initializing", url],
      },
    },
    {
      initializing: (uri, signal) => {
        return articleLdFetcher(uri, signal).then<ArticleViewAction>(
          (article) => ["loadedLinkedData", article]
        );
      },
      initializingContent: (article) => {
        return contentFetcher(article.ld).then<ArticleViewAction>((content) => [
          "loadedContent",
          content,
        ]);
      },
      loading({ newUrl }, signal) {
        return articleLdFetcher(newUrl, signal).then<ArticleViewAction>(
          (article) => ["loadedLinkedData", article]
        );
      },
      loadingContent({ newArticleLdWithHash }) {
        return contentFetcher(newArticleLdWithHash.ld).then<ArticleViewAction>(
          (content) => ["loadedContent", content]
        );
      },
    }
  );

const getUri = map(
  (queryParams: URLSearchParams) =>
    queryParams.get("uri") || "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu"
);

const newArticleStateProcessor = ({
  articleLdFetcher,
  contentFetcher,
}: {
  articleLdFetcher: ArticleLdFetcher;
  contentFetcher: ArticleContentFetcher;
}): CancelableProcessor<RetryAction, ArticleViewState> => (signal, push) => {
  const articleViewStateMachine = newArticleViewStateMachine({
    articleLdFetcher,
    contentFetcher,
  })(push);

  linkHijackToQueryParams(
    signal,
    getUri(
      map((uri) => ["loading", uri] as ArticleViewAction)(
        articleViewStateMachine
      )
    )
  );

  return articleViewStateMachine;
};

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

const ArticleViewWithLoader: React.FC<ArticleContent> = (existingArticle) => (
  <React.Fragment>
    <CenterLoading />
    <ArticleView {...existingArticle} />
  </React.Fragment>
);

const stateMapperToView = (retry: Consumer<RetryAction>) =>
  newStateMapper<ArticleViewState, ReturnType<React.FC>>({
    idle: () => <CenterLoading />,
    initializing: () => <CenterLoading />,
    initializingContent: () => <CenterLoading />,
    loaded: (content) => <ArticleView {...content} />,
    loading: ({ existingArticle }) => (
      <ArticleViewWithLoader {...existingArticle} />
    ),
    loadingContent: ({ existingArticle }) => (
      <ArticleViewWithLoader {...existingArticle} />
    ),
    error: ({ reason }) => {
      return (
        <div>
          <span>Error: {reason}</span>
          <button onClick={() => retry(["retry"])}>Retry</button>
        </div>
      );
    },
  });

export const ArticleComponent: React.FC<{
  articleLdFetcher: ArticleLdFetcher;
  contentFetcher: ArticleContentFetcher;
  onArticleLoaded?: (article: LinkedDataWithItsHash<Article>) => void;
}> = ({ articleLdFetcher, contentFetcher, onArticleLoaded }) => {
  const [articleViewState, retry] = useCancelableProcessor(
    useCallback(
      () => newArticleStateProcessor({ articleLdFetcher, contentFetcher }),
      [articleLdFetcher, contentFetcher]
    ),
    articleViewInitState as ArticleViewState
  );

  useEffect(() => {
    if (onArticleLoaded) {
      if (articleViewState[0] === "initializingContent") {
        onArticleLoaded(articleViewState[1]);
      } else if (articleViewState[0] === "loadingContent") {
        onArticleLoaded(articleViewState[1].newArticleLdWithHash);
      }
    }
  }, [articleViewState, onArticleLoaded]);

  return stateMapperToView(retry)(articleViewState);
};
