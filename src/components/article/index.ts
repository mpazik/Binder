import { URL } from "schema-dts";

import {
  LinkedDataWithDocument,
  processFileToArticle,
} from "../../functions/article-processor";
import { DocumentAnnotationsIndex } from "../../functions/indexes/document-annotations-index";
import { LinkedDataWithDocumentFetcher } from "../../functions/linked-data-fetcher";
import {
  LinkedDataStoreWrite,
  ResourceStoreWrite,
} from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { Consumer, dataPortal, fork, Provider } from "../../libs/connections";
import {
  closableForEach,
  map,
  mapAwait,
  merge,
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

type ArticleStateWithFeedback = StateWithFeedback<
  ArticleViewState,
  ArticleViewAction
>;
const newArticleViewStateMachine = ({
  contentFetcher,
}: {
  contentFetcher: LinkedDataWithDocumentFetcher;
}) => {
  const fetchContent = (
    newUrl: string,
    signal: AbortSignal
  ): Promise<ArticleViewAction> =>
    contentFetcher(newUrl, signal)
      .then((article) => ["display", article] as ArticleViewAction)
      .catch((error) => ["fail", error.toString()] as ArticleViewAction);

  return (push: Consumer<ArticleStateWithFeedback>) =>
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
          display: (articleContent) => ["ready", articleContent],
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
      closableForEach(({ state, feedback }, signal) => {
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
  ArticleStateWithFeedback
> = ({ contentSlot }) => ({ state }) =>
  mapState(state, {
    idle: () => div(centerLoadingSlot()),
    initializing: () => div(centerLoadingSlot()),
    loading: () => div(centerLoadingSlot(), contentSlot),
    ready: () => div(contentSlot),
    error: ({ reason }) =>
      div({ class: "flash mt-3 flash-error" }, span(reason)),
  });

export const articleComponent: Component<{
  userEmailProvider: Provider<string>;
  documentAnnotationsIndex: DocumentAnnotationsIndex;
  contentFetcher: LinkedDataWithDocumentFetcher;
  onArticleLoaded?: (article: LinkedData) => void;
  storeWrite: ResourceStoreWrite;
  ldStoreWrite: LinkedDataStoreWrite;
  ldStoreRead: LinkedDataStoreRead;
  uriProvider: Provider<string | undefined | null>;
  fileProvider: Provider<Blob>;
}> = ({
  documentAnnotationsIndex,
  onArticleLoaded,
  contentFetcher,
  storeWrite,
  ldStoreWrite,
  ldStoreRead,
  uriProvider,
  fileProvider,
  userEmailProvider,
}) => (render) => {
  const [dataProvider, onLoaded] = dataPortal<LinkedDataWithDocument>();

  const [creatorProvider, setCreator] = dataPortal<string>();
  const [setUser, setState] = merge(
    (user: string, { state }: ArticleStateWithFeedback) => {
      if (state[0] in ["loading", "ready"]) {
        setCreator(user);
      }
    }
  );
  userEmailProvider(setUser);

  const contentSlot = slot(
    "content-blah",
    editableContentComponent({
      storeWrite,
      ldStoreWrite,
      ldStoreRead,
      documentAnnotationsIndex,
      creatorProvider,
      provider: dataProvider,
      onSave: (linkedData) => {
        onArticleLoaded?.(linkedData);
      },
    })
  );

  const renderState = map(createArticleView({ contentSlot }), render);

  const onLoadedParentHandler = ({ state }: ArticleStateWithFeedback) =>
    handleState<ArticleViewState>(state, {
      ready: (state) => {
        onLoaded(state);
        onArticleLoaded?.(state.linkedData);
      },
    });

  const articleViewStateMachine = newArticleViewStateMachine({
    contentFetcher,
  })(fork(renderState, onLoadedParentHandler, setState));

  uriProvider(
    map((uri) => ["load", uri] as ArticleViewAction, articleViewStateMachine)
  );
  fileProvider(
    mapAwait(
      processFileToArticle,
      map(
        (article) => ["display", article] as ArticleViewAction,
        articleViewStateMachine
      ),
      (error) => {
        console.error(error);
      }
    )
  );
};
