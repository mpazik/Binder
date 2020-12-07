import { Article, URL } from "schema-dts";

import { ArticleContentFetcher } from "../functions/article-content-fetcher";
import { ArticleLdFetcher } from "../functions/article-ld-fetcher";
import { ArticleContent } from "../functions/article-processor";
import { linkHijackToQueryParams } from "../functions/url-hijack";
import { Action, dataPortal, fork, map, Provider } from "../libs/connections";
import { findUri, LinkedDataWithItsHash } from "../libs/linked-data";
import {
  newStateHandler,
  newStateMapper,
  stateMachineWithFeedback,
} from "../libs/named-state";
import {
  a,
  article,
  button,
  Component,
  ComponentRuntime,
  dangerousInnerHtml,
  div,
  slot,
  span,
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

const nop = () => {
  // ingore
};

const getUri = map(
  (queryParams: URLSearchParams) =>
    queryParams.get("uri") || "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu"
);

const articleContentComponent: Component<{
  provider: Provider<ArticleContent>;
}> = ({ provider }) => (render) => {
  provider(
    map(({ content, linkedData }: ArticleContent) => {
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
    })(render)
  );
};

const articleView: ViewSetup<
  { retry: Action; articleContentComponent: ComponentRuntime },
  ArticleViewState
> = ({ retry, articleContentComponent }) =>
  newStateMapper({
    idle: () => {
      return div(slot("loading", centerLoading));
    },
    initializing: () => {
      return div(slot("loading", centerLoading));
    },
    initializingContent() {
      return div(slot("loading", centerLoading));
    },
    loaded: () => div(slot("content", articleContentComponent)),
    loading: () =>
      div(
        slot("loading", centerLoading),
        slot("content", articleContentComponent)
      ),
    loadingContent: () =>
      div(
        slot("loading", centerLoading),
        slot("content", articleContentComponent)
      ),
    error: ({ reason }) => {
      return div(
        span("Error: ", reason),
        button({ onClose: () => retry() }, "Retry")
      );
    },
  });

export const articleComponent: Component<{
  articleLdFetcher: ArticleLdFetcher;
  contentFetcher: ArticleContentFetcher;
  onArticleLoaded?: (article: LinkedDataWithItsHash<Article>) => void;
}> = ({ articleLdFetcher, onArticleLoaded, contentFetcher }) => (
  render,
  onClose
) => {
  const [articleContentProvider, updateArticleContent] = dataPortal<
    ArticleContent
  >();

  const articleViewStateMachine = newArticleViewStateMachine({
    articleLdFetcher,
    contentFetcher,
  })(
    fork(
      map(
        articleView({
          retry: () => {
            articleViewStateMachine(["retry"]);
          },
          articleContentComponent: articleContentComponent({
            provider: articleContentProvider,
          }),
        })
      )(render),
      newStateHandler<ArticleViewState>({
        loaded: (state) => {
          updateArticleContent(state);
        },
      }),
      onArticleLoaded
        ? newStateHandler<ArticleViewState>({
            initializingContent: (state) => onArticleLoaded(state),
            loadingContent: (state) =>
              onArticleLoaded(state.newArticleLdWithHash),
          })
        : nop
    )
  );

  linkHijackToQueryParams(
    onClose,
    getUri(
      map((uri) => ["loading", uri] as ArticleViewAction)(
        articleViewStateMachine
      )
    )
  );
};
