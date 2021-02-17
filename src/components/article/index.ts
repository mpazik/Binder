import { URL } from "schema-dts";

import { LinkedDataWithDocument } from "../../functions/article-processor";
import { ArticleSaver } from "../../functions/article-saver";
import { LinkedDataWithDocumentFetcher } from "../../functions/linked-data-fetcher";
import { currentDocumentUriProvider } from "../../functions/url-hijack";
import { Consumer, fork } from "../../libs/connections";
import {
  forEach,
  map,
  withDefaultValue,
} from "../../libs/connections/processors2";
import { findUrl, LinkedData } from "../../libs/linked-data";
import {
  handleState,
  mapState,
  newStateMachineWithFeedback2,
  StateWithFeedback,
} from "../../libs/named-state";
import {
  Component,
  div,
  slotForEntity,
  span,
  View,
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

type ArtileStateWithFeedback = StateWithFeedback<
  ArticleViewState,
  ArticleViewAction
>;
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

  return (push: Consumer<ArtileStateWithFeedback>) =>
    newStateMachineWithFeedback2<ArticleViewState, ArticleViewAction>(
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
      forEach(({ state, feedback }, signal) => {
        handleState<ArticleViewState>(state, {
          initializing: (url) => {
            fetchContent(url, signal).then(feedback);
          },
          loading: ({ newUrl }) => {
            fetchContent(newUrl, signal).then(feedback);
          },
          saving: ({ articleToSave }) =>
            articleSaver(articleToSave)
              .then((newLinkedData) =>
                feedback([
                  "display",
                  { ...articleToSave, linkedData: newLinkedData },
                ] as ArticleViewAction)
              )
              .catch((error) => feedback(["fail", error.toString()])),
        });
      }, push)
    );
};

const createOnSave = (feedback: Consumer<ArticleViewAction>) => (
  article: LinkedDataWithDocument
) => {
  feedback(["save", article]);
};

const articleView: View<ArtileStateWithFeedback> = ({ state, feedback }) => {
  return mapState(state, {
    idle: () => div(centerLoadingSlot()),
    initializing: () => div(centerLoadingSlot()),
    loading: ({ existingArticle }) =>
      div(centerLoadingSlot(), contentView({ data: existingArticle })),
    ready: (state) => {
      return div(
        contentView({
          data: state,
          onSave: createOnSave(feedback),
        })
      );
    },
    saving: ({ existingArticle }) => {
      return div(
        contentView({
          data: existingArticle,
          editState: ["saving"],
          onSave: createOnSave(feedback),
        })
      );
    },
    savingError: ({ existingArticle, reason }) => {
      return div(
        contentView({
          data: existingArticle,
          editState: ["error", reason],
          onSave: createOnSave(feedback),
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
  const renderState = map(articleView, render);

  const onLoadedParentHandler = ({ state }: ArtileStateWithFeedback) =>
    handleState<ArticleViewState>(state, {
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
