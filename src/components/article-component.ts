import { Article, URL } from "schema-dts";

import { ArticleContentFetcher } from "../functions/article-content-fetcher";
import { ArticleLdFetcher } from "../functions/article-ld-fetcher";
import { ArticleContent } from "../functions/article-processor";
import { linkHijackToQueryParams } from "../functions/url-hijack";
import { Action, actionPortal, fork, map } from "../libs/connections";
import { findUri, LinkedDataWithItsHash } from "../libs/linked-data";
import { newStateMapper, stateMachineWithFeedback } from "../libs/named-state";
import {
  a,
  article,
  button,
  Component,
  div,
  dangerousInnerHtml,
  slot,
  span,
  View,
  fragment,
  ViewSetup,
} from "../libs/simple-ui/render";

import { centerLoading } from "./common/center-loading";

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

const articleContentView: View<ArticleContent> = ({ content, linkedData }) => {
  const uri = findUri(linkedData);
  return div(
    { id: "content", class: "mb-3 markdown-body" },
    div(
      { class: "Subhead" },
      div({ class: "Subhead-heading" }, String(linkedData.name)),
      div(
        { class: "Subhead-description" },
        ...(uri
          ? [span("From: ", a({ href: uri }, new URL(uri).hostname))]
          : [])
      )
    ),
    article(dangerousInnerHtml(content.body.innerHTML))
  );
};

const articleViewWithLoader: View<ArticleContent> = (existingArticle) =>
  fragment(
    // slot("loading", centerLoading()),
    articleContentView(existingArticle)
  );

const articleView: ViewSetup<{ retry: Action }, ArticleViewState> = ({
  retry,
}) =>
  newStateMapper({
    idle: () => slot("loading1", centerLoading()),
    initializing: () => slot("loading2", centerLoading()),
    initializingContent: () => slot("loading3", centerLoading()),
    loaded: (content) => articleContentView(content),
    loading: ({ existingArticle }) => articleViewWithLoader(existingArticle),
    loadingContent: ({ existingArticle }) =>
      articleViewWithLoader(existingArticle),
    error: ({ reason }) => {
      return div(
        span("Error: ", reason),
        button({ onClose: () => retry() }, "Retry")
      );
    },
  });

export const articleContentComponent: Component<{
  articleLdFetcher: ArticleLdFetcher;
  contentFetcher: ArticleContentFetcher;
  onArticleLoaded?: (article: LinkedDataWithItsHash<Article>) => void;
}> = ({ articleLdFetcher, onArticleLoaded, contentFetcher }) => (
  render,
  onClose
) => {
  const [onRetry, retry] = actionPortal();
  const articleViewStateMachine = newArticleViewStateMachine({
    articleLdFetcher,
    contentFetcher,
  })(
    fork((state: ArticleViewState) => {
      if (onArticleLoaded) {
        if (state[0] === "initializingContent") {
          onArticleLoaded(state[1]);
        } else if (state[0] === "loadingContent") {
          onArticleLoaded(state[1].newArticleLdWithHash);
        }
      }
    }, map(articleView({ retry }))(render))
  );
  onRetry(() => articleViewStateMachine(["retry"]));

  linkHijackToQueryParams(
    onClose,
    getUri(
      map((uri) => ["loading", uri] as ArticleViewAction)(
        articleViewStateMachine
      )
    )
  );
};
