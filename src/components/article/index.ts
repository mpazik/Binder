import { URL } from "schema-dts";

import { LinkedDataWithDocument } from "../../functions/article-processor";
import { ArticleSaver } from "../../functions/article-saver";
import { LinkedDataWithDocumentFetcher } from "../../functions/linked-data-fetcher";
import { currentDocumentUriProvider } from "../../functions/url-hijack";
import { Consumer, dataPortal, fork } from "../../libs/connections";
import {
  forEach,
  map,
  withDefaultValue,
} from "../../libs/connections/processors2";
import { LinkedData } from "../../libs/linked-data";
import {
  handleState,
  mapState,
  newStateMachineWithFeedback2,
  StateWithFeedback,
} from "../../libs/named-state";
import {
  Component,
  div,
  JsonHtml,
  slot,
  span,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { centerLoadingSlot } from "../common/center-loading-component";

import { editableContentComponent } from "./content-view";

type RetryAction = ["retry"];
type ArticleViewAction =
  | ["load", URL]
  | ["display", LinkedDataWithDocument]
  | ["fail", string]
  | RetryAction;

export type ArticleViewState =
  | ["idle"]
  | ["initializing", URL]
  | ["ready", LinkedDataWithDocument]
  | ["loading", { existingArticle: LinkedDataWithDocument; newUrl: URL }]
  | ["error", { reason: string; url: URL }];

const articleViewInitState: ArticleViewState = ["idle"];

type ArtileStateWithFeedback = StateWithFeedback<
  ArticleViewState,
  ArticleViewAction
>;
const newArticleViewStateMachine = ({
  contentFetcher,
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
      },
      forEach(({ state, feedback }, signal) => {
        handleState<ArticleViewState>(state, {
          initializing: (url) => {
            fetchContent(url, signal).then(feedback);
          },
          loading: ({ newUrl }) => {
            fetchContent(newUrl, signal).then(feedback);
          },
        });
      }, push)
    );
};

const createArticleView: ViewSetup<
  { contentSlot: JsonHtml },
  ArtileStateWithFeedback
> = ({ contentSlot }) => ({ state }) => {
  return mapState(state, {
    idle: () => div(centerLoadingSlot()),
    initializing: () => div(centerLoadingSlot()),
    loading: () => div(centerLoadingSlot(), contentSlot),
    ready: () => div(contentSlot),
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
  const [dataProvider, onLoaded] = dataPortal<LinkedDataWithDocument>();
  const contentSlot = slot(
    "content-blah",
    editableContentComponent({
      articleSaver,
      provider: dataProvider,
    })
  );

  const renderState = map(createArticleView({ contentSlot }), render);

  const onLoadedParentHandler = ({ state }: ArtileStateWithFeedback) =>
    handleState<ArticleViewState>(state, {
      ready: (state) => {
        onLoaded(state);
        onArticleLoaded?.(state.linkedData);
      },
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
