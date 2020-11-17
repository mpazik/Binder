import React from "react";

import { Article, URL } from "schema-dts";

import { ArticleContentFetcher } from "../functions/article-content-fetcher";
import { ArticleLdFetcher } from "../functions/article-ld-fetcher";
import { ArticleContent } from "../functions/article-processor";
import { linkHijackToQueryParams } from "../functions/url-hijack";
import { HandlerRegister, map, Processor } from "../utils/connections";
import { findUri, LinkedDataWithItsHash } from "../utils/linked-data";
import { newStateMapper, stateMachine } from "../utils/named-state";
import { useProvider } from "../utils/react";

import { CenterLoading } from "./common/center-loading";

type ArticleViewAction =
  | ["loading", URL]
  | ["loadedLinkedData", LinkedDataWithItsHash<Article>]
  | ["loadedContent", Document];

export type ArticleViewState =
  | ["initializing"]
  | ["initializingContent", LinkedDataWithItsHash<Article>]
  | ["loaded", ArticleContent]
  | ["loading", { existingArticle: ArticleContent }]
  | [
      "loadingContent",
      {
        newArticleLdWithHash: LinkedDataWithItsHash<Article>;
        existingArticle: ArticleContent;
      }
    ];

const articleViewInitState: ArticleViewState = ["initializing"];
const articleViewStateMachine = stateMachine<
  ArticleViewState,
  ArticleViewAction
>(articleViewInitState, {
  initializing: {
    loading: () => ["initializing"], // ignore loading action
    loadedLinkedData: (articleWithHash) => [
      "initializingContent",
      articleWithHash,
    ],
  },
  initializingContent: {
    loadedContent: (content, ldWithHash) => [
      "loaded",
      { content, linkedData: ldWithHash.ld },
    ],
  },
  loaded: {
    loading: (_, existingArticle) => ["loading", { existingArticle }],
  },
  loading: {
    loadedLinkedData: (articleWithHash, { existingArticle }) => [
      "loadingContent",
      { newArticleLdWithHash: articleWithHash, existingArticle },
    ],
  },
  loadingContent: {
    loadedContent: (content, { newArticleLdWithHash }) => [
      "loaded",
      { content, linkedData: newArticleLdWithHash.ld },
    ],
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

const ArticleViewWithLoader: React.FC<ArticleContent> = (existingArticle) => (
  <React.Fragment>
    <CenterLoading />
    <ArticleView {...existingArticle} />
  </React.Fragment>
);

const stateMapperToView = newStateMapper<
  ArticleViewState,
  ReturnType<React.FC>
>({
  initializing: () => <CenterLoading />,
  initializingContent: () => <CenterLoading />,
  loaded: (content) => <ArticleView {...content} />,
  loading: ({ existingArticle }) => (
    <ArticleViewWithLoader {...existingArticle} />
  ),
  loadingContent: ({ existingArticle }) => (
    <ArticleViewWithLoader {...existingArticle} />
  ),
});

const getUri = map(
  (queryParams: URLSearchParams) =>
    queryParams.get("uri") || "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu"
);

const something = ({
  onClose,
  articleLdFetcher,
  contentFetcher,
}: {
  onClose: HandlerRegister;
  articleLdFetcher: ArticleLdFetcher;
  contentFetcher: ArticleContentFetcher;
}): Processor<string, ArticleViewAction> => (push) => (uri) => {
  push(["loading", uri]);
  const controller = new AbortController();
  (async () => {
    const article = await articleLdFetcher(uri, controller.signal);
    push(["loadedLinkedData", article]);
    const content = await contentFetcher(article.ld);
    push(["loadedContent", content]);
  })();
  onClose(() => {
    controller.abort();
  });
};

const useArticleContentProvider = ({
  articleLdFetcher,
  contentFetcher,
}: {
  articleLdFetcher: ArticleLdFetcher;
  contentFetcher: ArticleContentFetcher;
  onArticleLoaded?: (article: LinkedDataWithItsHash<Article>) => void;
}): ArticleViewState => {
  return useProvider((onClose, push) => {
    linkHijackToQueryParams(
      onClose,
      getUri(
        something({ onClose, articleLdFetcher, contentFetcher })(
          articleViewStateMachine(push)
        )
      )
    );
  }, articleViewInitState as ArticleViewState);
};

export const ArticleComponent: React.FC<{
  articleLdFetcher: ArticleLdFetcher;
  contentFetcher: ArticleContentFetcher;
  onArticleLoaded?: (article: LinkedDataWithItsHash<Article>) => void;
}> = (props) => {
  const articleViewState = useArticleContentProvider(props);
  if (props.onArticleLoaded) {
    if (articleViewState[0] === "initializingContent") {
      props.onArticleLoaded(articleViewState[1]);
    } else if (articleViewState[0] === "loadingContent") {
      props.onArticleLoaded(articleViewState[1].newArticleLdWithHash);
    }
  }

  return stateMapperToView(articleViewState);
};
