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
import { currentDocumentUriProvider } from "../../functions/url-hijack";
import {
  closableForEach,
  combine,
  Consumer,
  fork,
} from "../../libs/connections";
import { ignore, map, mapAwait, pick } from "../../libs/connections/mappers";
import { LinkedData } from "../../libs/linked-data";
import {
  handleState,
  mapState,
  newStateMachineWithFeedback,
  StateWithFeedback,
} from "../../libs/named-state";
import {
  Component,
  div,
  JsonHtml,
  newSlot,
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
    newStateMachineWithFeedback<ArticleViewState, ArticleViewAction>(
      articleViewInitState,
      {
        idle: {
          load: (url) => ["initializing", url],
          display: (articleContent) => ["ready", articleContent],
        },
        initializing: {
          load: (url) => ["initializing", url],
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
          load: (url, { existingArticle }) => [
            "loading",
            { existingArticle, newUrl: url },
          ],
          display: (articleContent) => ["ready", articleContent],
          fail: (reason, { newUrl }) => ["error", { reason, url: newUrl }],
        },
        error: {
          load: (url) => ["initializing", url],
          display: (articleContent) => ["ready", articleContent],
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

const scrollTop = () => {
  window.scrollTo(0, 0);
};

export const articleComponent: Component<
  {
    documentAnnotationsIndex: DocumentAnnotationsIndex;
    contentFetcher: LinkedDataWithDocumentFetcher;
    onArticleLoaded?: (article: LinkedData) => void;
    storeWrite: ResourceStoreWrite;
    ldStoreWrite: LinkedDataStoreWrite;
    ldStoreRead: LinkedDataStoreRead;
  },
  {
    setUserEmail: string;
    setUri: string | undefined | null;
    provideFile: Blob;
  }
> = ({
  documentAnnotationsIndex,
  onArticleLoaded,
  contentFetcher,
  storeWrite,
  ldStoreWrite,
  ldStoreRead,
}) => (render, onClose) => {
  const [setUser, setState] = combine<[string, ArticleStateWithFeedback]>(
    ([user, { state }]) => {
      if (["loading", "ready"].includes(state[0])) {
        setCreator(user);
      }
    },
    undefined,
    undefined
  );

  const [contentSlot, { setCreator, setContent }] = newSlot(
    "content-blah",
    editableContentComponent({
      storeWrite,
      ldStoreWrite,
      ldStoreRead,
      documentAnnotationsIndex,
      onSave: (linkedData) => {
        onArticleLoaded?.(linkedData);
      },
    })
  );

  const renderState = map(createArticleView({ contentSlot }), render);

  const onLoadedParentHandler = ({ state }: ArticleStateWithFeedback) =>
    handleState<ArticleViewState>(state, {
      ready: fork(
        setContent,
        onArticleLoaded ? map(pick("linkedData"), onArticleLoaded) : ignore,
        scrollTop
      ),
    });

  const articleViewStateMachine = newArticleViewStateMachine({
    contentFetcher,
  })(fork(renderState, onLoadedParentHandler, setState));

  const setUri = map(
    (uri) => ["load", uri] as ArticleViewAction,
    articleViewStateMachine
  );

  currentDocumentUriProvider({
    defaultUri: "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu",
  })(onClose, setUri);

  return {
    setUserEmail: setUser,
    provideFile: mapAwait(
      processFileToArticle,
      map(
        (article) => ["display", article] as ArticleViewAction,
        articleViewStateMachine
      ),
      (error) => {
        console.error(error);
      }
    ),
    setUri,
  };
};
