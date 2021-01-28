import { Article, URL } from "schema-dts";

import { ArticleContentFetcher } from "../functions/article-content-fetcher";
import { ArticleLdFetcher } from "../functions/article-ld-fetcher";
import {
  ArticleContent,
  getDocumentContentRoot,
} from "../functions/article-processor";
import { linkHijackToQueryParams } from "../functions/url-hijack";
import {
  Action,
  Consumer,
  dataPortal,
  fork,
  map,
  passOnlyChanged,
  Provider,
} from "../libs/connections";
import { findUri, LinkedDataWithItsHash } from "../libs/linked-data";
import {
  newStateHandler,
  newStateMachineWithFeedback,
  newStateMapper,
} from "../libs/named-state";
import {
  a,
  article,
  button,
  Component,
  div,
  JsonHtml,
  slot,
  span,
  ViewSetup,
} from "../libs/simple-ui/render";
import { throttleArg } from "../libs/throttle";

import {
  changesIndicatorBar,
  documentChangeTopRelativePosition,
} from "./article/change-indicator-bar";
import {
  DocumentChange,
  newDocumentComparator,
  revertDocumentChange,
} from "./article/document-change";
import { renderDocumentChangeModal } from "./article/document-change-modal";
import { editBar, EditBarState } from "./article/edit-bar";
import { centerLoadingSlot } from "./common/center-loading-component";
import { modal, ModalState } from "./common/modal";

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
  newStateMachineWithFeedback<ArticleViewState, ArticleViewAction>(
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

const changesToEditorBarState = (changes: DocumentChange[]): EditBarState =>
  changes.length === 0
    ? ["hidden"]
    : ["visible", { editor: changes[0].editor }];

const articleContentView: Component<{
  provider: Provider<ArticleContent>;
  onEdit: Consumer<Document>;
}> = ({ provider, onEdit }) => (render) => {
  provider(
    map(({ content, linkedData }: ArticleContent) => {
      const uri = findUri(linkedData);
      const contentRoot = getDocumentContentRoot(content);

      // ideally should be triggered on resize too
      const [onInputProvider, onInputConsumer] = dataPortal<Element>();
      const onInputThrottledConsumer = throttleArg<Element>(
        onInputConsumer,
        300
      );
      const [changesProvider, changesConsumer] = dataPortal<DocumentChange[]>();
      const [changesProviderForBar, changesConsumerForBar] = dataPortal<
        DocumentChange[]
      >();
      onInputProvider(map(newDocumentComparator(contentRoot))(changesConsumer));

      const [editBarStateProvider, editBarStateConsumer] = dataPortal<
        EditBarState
      >();
      changesProvider(
        fork(
          changesConsumerForBar,
          map(changesToEditorBarState)(passOnlyChanged(editBarStateConsumer))
        )
      );

      const [stateProvider, stateConsumer] = dataPortal<ModalState>();
      const onDiffBarClick: Consumer<DocumentChange> = (change) => {
        const { oldLines } = change;
        stateConsumer({
          top: documentChangeTopRelativePosition(change),
          left: 20,
          content: renderDocumentChangeModal({
            oldLines,
            onRevert: () => {
              revertDocumentChange(change);
              stateConsumer(undefined);
            },
          }),
        });
      };

      return div(
        { id: "content" },
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
        div(
          { id: "editor", class: "mb-3 position-relative" },
          slot(
            "gutter",
            changesIndicatorBar({
              changesProvider: changesProviderForBar,
              onDiffBarClick,
            })
          ),
          slot("modal-diff", modal({ stateProvider })),
          article({
            id: "editor-body",
            contenteditable: true,
            class: "editable markdown-body ml-4 flex-1",
            style: { outline: "none" },
            onInput: (e) => onInputThrottledConsumer(e.target as HTMLElement),
            dangerouslySetInnerHTML: contentRoot?.innerHTML,
          }),
          slot(
            "edit-bar",
            editBar({
              initialContent: content,
              onPublish: onEdit,
              provider: editBarStateProvider,
            })
          )
        )
      );
    })(render)
  );
};

const articleView: ViewSetup<
  { retry: Action; articleContentSlot: JsonHtml },
  ArticleViewState
> = ({ retry, articleContentSlot }) =>
  newStateMapper({
    idle: () => div(centerLoadingSlot()),
    initializing: () => div(centerLoadingSlot()),
    initializingContent: () => div(centerLoadingSlot()),
    loading: () => div(centerLoadingSlot(), articleContentSlot),
    loadingContent: () => div(centerLoadingSlot(), articleContentSlot),
    loaded: () => div(articleContentSlot),
    error: ({ reason }) =>
      div(span("Error: ", reason), button({ onClose: () => retry() }, "Retry")),
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

  const articleContentSlot = slot(
    "content",
    articleContentView({
      provider: articleContentProvider,
      onEdit: (document) => {
        console.log("new document", document);
      },
    })
  );

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
          articleContentSlot,
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
        : () => {}
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
