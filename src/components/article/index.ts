import { URL } from "schema-dts";

import { LinkedDataWithDocument } from "../../functions/article-processor";
import { ArticleSaver } from "../../functions/article-saver";
import { LinkedDataWithDocumentFetcher } from "../../functions/linked-data-fetcher";
import { currentDocumentUriProvider } from "../../functions/url-hijack";
import { fork } from "../../libs/connections";
import { map, withDefaultValue } from "../../libs/connections/processors2";
import {
  findHashUri,
  findUrl,
  getUrls,
  LinkedData,
} from "../../libs/linked-data";
import {
  newStateHandler,
  newStateMachineWithFeedback,
  newStateMapper,
} from "../../libs/named-state";
import {
  Component,
  div,
  slot,
  slotForEntity,
  span,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { centerLoadingSlot } from "../common/center-loading-component";

import { contentView } from "./content-view";

type RetryAction = ["retry"];
type ArticleViewAction =
  | ["load", URL]
  | ["display", LinkedDataWithDocument]
  | ["fail", string]
  | ["save", LinkedDataWithDocument]
  | RetryAction
  | ["retrySave"];

export type ArticleViewState =
  | ["idle"]
  | ["initializing", URL]
  | ["ready", LinkedDataWithDocument]
  | ["loading", { existingArticle: LinkedDataWithDocument; newUrl: URL }]
  | ["error", { reason: string; url: URL }]
  | [
      "saving",
      {
        existingArticle: LinkedDataWithDocument;
        articleToSave: LinkedDataWithDocument;
      }
    ]
  | [
      "savingError",
      {
        reason: string;
        existingArticle: LinkedDataWithDocument;
        articleToSave: LinkedDataWithDocument;
      }
    ];

const articleViewInitState: ArticleViewState = ["idle"];

const newArticleViewStateMachine = ({
  contentFetcher,
  articleSaver,
}: {
  contentFetcher: LinkedDataWithDocumentFetcher;
  articleSaver: ArticleSaver;
}) => {
  const fetchContent = (
    newUrl: string,
    signal: AbortSignal
  ): Promise<ArticleViewAction> =>
    contentFetcher(newUrl, signal)
      .then((article) => ["display", article] as ArticleViewAction)
      .catch((error) => ["fail", error.toString()] as ArticleViewAction);

  return newStateMachineWithFeedback<ArticleViewState, ArticleViewAction>(
    articleViewInitState,
    {
      idle: {
        load: (url) => ["initializing", url],
      },
      initializing: {
        display: (articleContent) => ["ready", articleContent],
        fail: (reason, url) => ["error", { reason, url }],
      },
      ready: {
        load: (url, existingArticle) => [
          "loading",
          { existingArticle, newUrl: url },
        ],
        save: (articleToSave, existingArticle) => [
          "saving",
          { existingArticle, articleToSave },
        ],
      },
      loading: {
        display: (articleContent) => ["ready", articleContent],
        load: (url, { existingArticle }) => [
          "loading",
          { existingArticle, newUrl: url },
        ],
        fail: (reason, { newUrl }) => ["error", { reason, url: newUrl }],
      },
      error: {
        load: (url) => ["initializing", url],
        retry: (_, { url }) => ["initializing", url],
      },
      saving: {
        display: (articleContent) => ["ready", articleContent],
        fail: (reason, state) => ["savingError", { reason, ...state }],
      },
      savingError: {
        save: (articleToSave, state) => ["saving", state],
      },
    },
    {
      initializing: (url, signal) => fetchContent(url, signal),
      loading: ({ newUrl }, signal) => fetchContent(newUrl, signal),
      saving: ({ articleToSave }): Promise<ArticleViewAction> =>
        articleSaver(articleToSave)
          .then(
            (newLinkedData) =>
              [
                "display",
                { ...articleToSave, linkedData: newLinkedData },
              ] as ArticleViewAction
          )
          .catch((error) => ["fail", error.toString()]),
    }
  );
};

const createArticleView: ViewSetup<
  (a: ArticleViewAction) => void,
  ArticleViewState
> = (onAction) => {
  const onSave = (article: LinkedDataWithDocument) => {
    onAction(["save", article]);
  };

  return newStateMapper({
    idle: () => div(centerLoadingSlot()),
    initializing: () => div(centerLoadingSlot()),
    loading: ({ existingArticle }) =>
      div(centerLoadingSlot(), contentView({ data: existingArticle })),
    ready: (state) => {
      slotForEntity("content", findUrl(state.linkedData), () => {});
      return div(contentView({ data: state, onSave }));
    },
    saving: ({ existingArticle }) => {
      return div(
        contentView({ data: existingArticle, editState: ["saving"], onSave })
      );
    },
    savingError: ({ existingArticle, reason }) => {
      return div(
        contentView({
          data: existingArticle,
          editState: ["error", reason],
          onSave,
        })
      );
    },
    error: ({ reason }) => {
      console.error(reason);
      return div({ class: "flash mt-3 flash-error" }, span(reason));
    },
  });
};

export const articleComponent: Component<{
  contentFetcher: LinkedDataWithDocumentFetcher;
  onArticleLoaded?: (article: LinkedData) => void;
  articleSaver: ArticleSaver;
}> = ({ onArticleLoaded, contentFetcher, articleSaver }) => (
  render,
  onClose
) => {
  const articleView = createArticleView((a) => articleViewStateMachine(a));
  const renderState = map(articleView, render);

  const onLoadedParentHandler = newStateHandler<ArticleViewState>({
    ready: (state) => onArticleLoaded?.(state.linkedData),
  });

  const articleViewStateMachine = newArticleViewStateMachine({
    contentFetcher,
    articleSaver,
  })(fork(renderState, onLoadedParentHandler));

  currentDocumentUriProvider(
    onClose,
    withDefaultValue(
      "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu" as string,
      map((uri) => ["load", uri] as ArticleViewAction, articleViewStateMachine)
    )
  );
};
