import type { Callback } from "linki";
import {
  asyncMapWithErrorHandler,
  defined,
  definedTuple,
  filter,
  fork,
  ignore,
  ignoreParam,
  link,
  map,
  passOnlyChanged,
  pick,
  pipe,
  reduce,
  split,
  to,
  withState,
} from "linki";

import type {
  AnalyticsSender,
  UpdateAnalyticsRepoAccount,
} from "../../functions/analytics";
import {
  initConfiguredAnalyticsForRepoAccount,
  createErrorSender,
} from "../../functions/analytics";
import type { LinkedDataWithContent } from "../../functions/content-processors";
import { processFileToContent } from "../../functions/content-processors";
import {
  blobToDocument,
  createDocument,
  documentToBlob,
} from "../../functions/content-processors/html-processor/utils";
import { createContentSaver } from "../../functions/content-saver";
import type { Fetch } from "../../functions/fetch-trough-proxy";
import { createProxyFetch } from "../../functions/fetch-trough-proxy";
import { createGDrive } from "../../functions/gdrive";
import { gdriveUserToAccount } from "../../functions/gdrive/auth";
import type { GDriveState } from "../../functions/gdrive/controller";
import { gdrive } from "../../functions/gdrive/controller";
import type { DriverAccount, GlobalDb } from "../../functions/global-db";
import { getLastLogin, openGlobalDb } from "../../functions/global-db";
import { createAnnotationsIndex } from "../../functions/indexes/annotations-index";
import { createCompositeIndexer } from "../../functions/indexes/composite-indexer";
import { createDirectoryIndex } from "../../functions/indexes/directory-index";
import type { SettingsRecord } from "../../functions/indexes/settings-index";
import {
  createSettingsIndexer,
  createSettingsStore,
  createSettingsSubscription,
  settingsStoreName,
} from "../../functions/indexes/settings-index";
import { createUriIndex } from "../../functions/indexes/url-index";
import {
  createWatchHistoryIndex,
  createWatchHistoryIndexer,
  createWatchHistorySearch,
  createWatchHistoryStore,
} from "../../functions/indexes/watch-history-index";
import type { LinkedDataWithContentFetcher } from "../../functions/linked-data-fetcher";
import { createLinkedDataWithDocumentFetcher } from "../../functions/linked-data-fetcher";
import type {
  RemoteDrive,
  RemoteDriverState,
} from "../../functions/remote-drive";
import type { StoreState } from "../../functions/store";
import { createStore } from "../../functions/store";
import type {
  RepositoryDb,
  UnclaimedRepositoryDb,
} from "../../functions/store/repository";
import {
  openAccountRepository,
  openUnclaimedRepository,
} from "../../functions/store/repository";
import { documentLinksUriProvider } from "../../functions/url-hijack";
import type { UriWithFragment } from "../../libs/browser-providers";
import {
  browserPathProvider,
  currentUriWithFragment,
  newUriWithFragment,
  updateBrowserHistory,
} from "../../libs/browser-providers";
import type { HashName, HashUri } from "../../libs/hash";
import { isHashUri } from "../../libs/hash";
import { storeGetAll } from "../../libs/indexeddb";
import type { LinkedData } from "../../libs/jsonld-format";
import { getPropertyValue, getType } from "../../libs/linked-data";
import { combine } from "../../libs/linki";
import { startChain } from "../../libs/linki/chain";
import {
  filterState,
  filterStates,
  handleState,
  newStateMapper,
} from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import type {
  Component,
  Handlers,
  Slot,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { div, newSlot, slot } from "../../libs/simple-ui/render";
import { accountPicker } from "../account-picker";
import { loader } from "../common/loader";
import { contentComponent } from "../content";
import { docsDirectory } from "../directory";
import type { Settings } from "../display-settings";
import { updateDisplaySettings } from "../display-settings";
import {
  setupDisplaySettingsPanel,
  typographyIcon,
} from "../display-settings/panel";
import { createSettingUpdateAction } from "../display-settings/replace-action";
import { fileDrop } from "../file-drop";
import { navigation } from "../navigation";
import { dropdown } from "../navigation/common";

type InitServices = {
  fetchTroughProxy: Fetch;
  globalDb: GlobalDb;
  unclaimedRepository: UnclaimedRepositoryDb;
  lastLogin: DriverAccount | undefined;
  initRepo: RepositoryDb;
  initialSettings: SettingsRecord[];
  sendAnalytics: AnalyticsSender;
  updateAnalyticsRepoAccount: UpdateAnalyticsRepoAccount;
};

export const initialiseServices = async (): Promise<InitServices> => {
  const [globalDb, fetchTroughProxy, unclaimedRepository] = await Promise.all([
    openGlobalDb(),
    createProxyFetch(),
    openUnclaimedRepository(),
  ]);
  const lastLogin = await getLastLogin(globalDb);
  const lastLoginRepo = lastLogin
    ? await openAccountRepository(lastLogin)
    : undefined;

  const initRepo = lastLoginRepo ?? unclaimedRepository;
  const initialSettings = await storeGetAll<SettingsRecord>(
    initRepo.getStoreProvider(settingsStoreName)
  );
  const [
    sendAnalytics,
    updateAnalyticsRepoAccount,
  ] = await initConfiguredAnalyticsForRepoAccount(lastLogin);

  return {
    fetchTroughProxy,
    globalDb,
    unclaimedRepository,
    lastLogin,
    initRepo,
    initialSettings,
    sendAnalytics,
    updateAnalyticsRepoAccount,
  };
};

type LinkedDataWithContentFetcherPassingUri = (
  request: UriWithFragment,
  signal?: AbortSignal
) => Promise<LinkedDataWithContent>;

const createContentFetcherPassingUri = (
  contentFetcher: LinkedDataWithContentFetcher
): LinkedDataWithContentFetcherPassingUri => async (
  { fragment, uri },
  signal?
) => ({
  fragment,
  ...(await contentFetcher(uri, signal)),
});

const createContainerView: ViewSetup<{
  navigationSlot: Slot;
  contentOrDirSlot: Slot;
  accountPickerSlot: Slot;
  fileDropSlot: Slot;
  onDragenter: (event: DragEvent) => void;
}> = ({
  navigationSlot,
  contentOrDirSlot,
  accountPickerSlot,
  fileDropSlot,
  onDragenter,
}) => () =>
  div(
    navigationSlot,
    div(
      {
        id: "container",
        style: {
          margin: "0 auto",
          minHeight: "100%",
        },
        onDragenter,
      },
      fileDropSlot,
      accountPickerSlot,
      contentOrDirSlot
    )
  );

export type LinkedDataWithBody = {
  linkedData: LinkedData;
  body: Node;
};
const isLinkedDataWithBody = (
  content: LinkedDataWithBody | LinkedDataWithContent
): content is LinkedDataWithBody => {
  return !!(content as LinkedDataWithBody).body;
};

export const App: Component<
  InitServices & { initialContent?: LinkedDataWithBody }
> = ({
  fetchTroughProxy,
  globalDb,
  unclaimedRepository,
  lastLogin,
  initRepo,
  initialSettings,
  sendAnalytics,
  updateAnalyticsRepoAccount,
  initialContent,
}) => (render, onClose) => {
  const urlIndex = createUriIndex();
  const directoryIndex = createDirectoryIndex();
  const annotationsIndex = createAnnotationsIndex();
  const [
    watchHistoryStore,
    switchRepoForWatchHistory,
  ] = createWatchHistoryStore();
  const watchHistoryIndex = createWatchHistoryIndex(watchHistoryStore);
  const searchWatchHistory = createWatchHistorySearch(watchHistoryStore);

  const [settingsStore, switchRepoForSettings] = createSettingsStore();
  const [
    displaySettings,
    updateSettings,
    subscribeToSettings,
  ] = createSettingsSubscription(initialSettings);

  const indexLinkedData = createCompositeIndexer([
    urlIndex.update,
    directoryIndex.update,
    annotationsIndex.update,
    createWatchHistoryIndexer(watchHistoryStore, (hash) =>
      store.removeLinkedData(hash)
    ),
    createSettingsIndexer(
      settingsStore,
      (hash) => store.removeLinkedData(hash),
      updateSettings
    ),
  ]);
  const store = createStore(
    indexLinkedData,
    fork(
      (state) => console.log("store - ", state),
      (s) => updateStoreState(s),
      (s) => storeStateForAccountPicker(s)
    ),
    unclaimedRepository,
    sendAnalytics
  );
  const updateRepo = fork(
    () => console.log("switching repo"),
    store.switchRepo,
    urlIndex.switchRepo,
    directoryIndex.switchRepo,
    annotationsIndex.switchRepo,
    switchRepoForWatchHistory,
    switchRepoForSettings
  );
  updateRepo(initRepo);
  const sendError = createErrorSender(sendAnalytics);

  const [gdriveStateForAccountPicker, storeStateForAccountPicker] = link(
    combine<[GDriveState | undefined, StoreState | undefined]>(
      undefined,
      undefined
    ),
    filter(definedTuple),
    ([gdriveState, storeState]) =>
      handleState<GDriveState>(gdriveState, {
        loggingIn: () => displayAccountPicker({ loading: true }),
        logged: () => closeAccountPicker(),
        signedOut: () => {
          handleState<StoreState>(storeState, {
            remoteDriveNeeded: () => displayAccountPicker({ loading: false }),
          });
        },
      })
  );

  const [pushCreator, updateCreatorState] = link(
    withState<[string | null, boolean]>([null, false]),
    filter(([, ready]) => ready),
    map(([creator]) => creator),
    filter((creator) => typeof creator !== "undefined"),
    (it) => setCreatorForContent(it)
  );
  const [setCreator, setContentReady] = link(
    combine(null as string | null, false),
    updateCreatorState
  );

  const updateGdrive = gdrive(
    fork(
      (state) => console.log("gdrive - ", state),
      (s) => updateGdriveState(s),
      link(
        filterStates("logged", "disconnected"),
        map(pick("user")),
        filter(defined),
        fork(
          (user) => console.log("switching user", user),
          link(map(pick("emailAddress")), (it) => setCreator(it)),
          link(map(gdriveUserToAccount), updateAnalyticsRepoAccount)
        )
      ),
      link(
        filterState("signedOut"),
        fork(
          () => console.log("signing out user"),
          link(map(to(null)), (it) => setCreator(it)),
          link(map(to(undefined)), updateAnalyticsRepoAccount)
        )
      ),
      link(
        map(
          newStateMapper<GDriveState, RemoteDriverState>(["off"], {
            loggingIn: () => ["loading"],
            profileRetrieving: () => ["loading"],
            logged: ({ config }) => {
              return ["on", createGDrive(config) as RemoteDrive];
            },
          })
        ),
        store.updateRemoteDriveState
      ),
      link(
        filterStates("disconnected", "signedOut"),
        map(pick("repository")),
        filter(defined),
        passOnlyChanged<RepositoryDb>(initRepo),
        fork(updateRepo, () => switchDisplayToDirectory())
      ),
      link(
        filterState("loadingError"),
        map((state) => ({
          key: "gdrive-loading-error",
          message: state.error,
        })),
        sendError
      ),
      link(
        filterState("loggingInError"),
        map((state) => ({
          key: "gdrive-logging-error",
          message: state.error,
        })),
        sendError
      ),
      (it) => gdriveStateForAccountPicker(it)
    ),
    globalDb,
    unclaimedRepository
  );

  const loadUri = link(
    reduce<UriWithFragment & { uriChanged: boolean }, UriWithFragment>(
      (old, { uri, fragment }) => ({
        uri,
        fragment,
        uriChanged: uri !== old.uri,
      }),
      { uri: "", uriChanged: false }
    ),
    link(split(pick("uriChanged")), [
      (it: UriWithFragment) => {
        setCurrentUri(it.uri);
        loadResource(it);
      },
      link(
        map<UriWithFragment, string | undefined>(pick("fragment")),
        filter(defined),
        fork(
          (it) => goToFragment(it),
          () => postDisplayHook()
        )
      ),
    ])
  );

  const loadUriWithRecentFragment: Callback<UriWithFragment> = link(
    asyncMapWithErrorHandler(
      async ({ uri, fragment }) => {
        if (!fragment && isHashUri(uri)) {
          const record = await watchHistoryIndex(uri as HashUri);
          if (record && record.fragment) {
            return { uri, fragment: record.fragment };
          }
        }
        return { uri, fragment };
      },
      (e) => console.error(e)
    ),
    loadUri
  );
  const createDisplaySettingUpdater = <T extends keyof Settings>(
    key: T
  ): ((value: Settings[T]) => void) =>
    link(
      map((it: Settings[T]) => createSettingUpdateAction(key, it)),
      store.writeLinkedData
    );

  const [
    navigationSlot,
    {
      updateStoreState,
      updateGdriveState,
      hideNav,
      hideNavPermanently,
      setCurrentUri,
      start: startNav,
      stop: stopNav,
    },
  ] = navigation({
    displayed:
      !initialContent || getType(initialContent.linkedData) != "AboutPage",
    updateGdrive,
    upload: store.upload,
    displayAccountPicker: () => displayAccountPicker({ loading: false }),
    initProfile: {
      repository: initRepo,
      user: lastLogin
        ? {
            emailAddress: lastLogin.email,
            displayName: lastLogin.name,
          }
        : undefined,
    },
    loadUri: fork(updateBrowserHistory, loadUri),
    searchDirectory: directoryIndex.search,
    searchWatchHistory,
    displaySettingsSlot: dropdown({
      icon: typographyIcon,
      title: "display settings",
      children: [
        setupDisplaySettingsPanel({
          onFontFaceChange: createDisplaySettingUpdater("fontFace"),
          onFontSizeChange: createDisplaySettingUpdater("fontSize"),
          onLineLengthChange: createDisplaySettingUpdater("lineLength"),
          onLineHeightChange: createDisplaySettingUpdater("lineHeight"),
          onThemeChange: createDisplaySettingUpdater("theme"),
        })(displaySettings),
      ],
    }),
  });

  const contentFetcherPassingUri = createContentFetcherPassingUri(
    createLinkedDataWithDocumentFetcher(
      async (uri: string): Promise<HashName | undefined> => {
        const result = await urlIndex.search({ url: uri });
        if (result.length > 0) {
          return result[0].hash;
        }
      },
      fetchTroughProxy,
      store.readLinkedData,
      store.readResource
    )
  );
  const postDisplayHook: Callback = fork(hideNav);

  const contentSaver = createContentSaver(
    store.writeResource,
    store.writeLinkedData
  );
  const [
    contentSlot,
    { displayContent, goToFragment, setCreator: setCreatorForContent },
  ] = newSlot(
    "content-container",
    contentComponent({
      contentSaver,
      ldStoreWrite: store.writeLinkedData,
      ldStoreRead: store.readLinkedData,
      annotationsIndex: annotationsIndex.search,
      onSave: ignore,
      onDisplay: postDisplayHook,
    })
  );

  const loadContent = (data: LinkedDataWithContent | LinkedDataWithBody) => {
    const pageType = getType(data.linkedData);
    if (pageType === "SearchResultsPage" || pageType === "NotFoundPage") {
      switchDisplayToDirectory();
      postDisplayHook();
    } else if (pageType === "AboutPage") {
      if (isLinkedDataWithBody(data)) {
        renderDirectly(data.body);
      } else {
        (async () => {
          const dom = await measureAsyncTime("parse", () =>
            blobToDocument(data.content)
          );
          renderDirectly(dom.body);
        })();
      }
    } else {
      const linkedDataWithContent: LinkedDataWithContent = isLinkedDataWithBody(
        data
      )
        ? {
            linkedData: data.linkedData,
            content: documentToBlob(
              createDocument({
                title: getPropertyValue(data.linkedData, "name"),
                contentRoot: data.body,
              })
            ),
          }
        : data;
      switchDisplayToContent();
      fork(displayContent, link(ignoreParam(), postDisplayHook), () => {
        setContentReady(true);
        pushCreator();
      })(linkedDataWithContent);
    }
  };

  const [
    contentOrDirSlot,
    { switchDisplayToContent, switchDisplayToDirectory, renderDirectly },
  ] = newSlot(
    "either-content",
    (
      render
    ): Handlers<{
      switchDisplayToContent: void;
      switchDisplayToDirectory: void;
      renderDirectly: Node;
    }> => {
      render("test test");

      return {
        switchDisplayToContent: () => {
          render(); // clean previous dom, to force rerender
          render(div({ class: "mt-8" }, contentSlot));
        },
        switchDisplayToDirectory: () => {
          render(); // clean previous dom, to force rerender
          render(div({ class: "mt-8" }, docsDirectorySlot));
        },
        renderDirectly: (element) => {
          hideNavPermanently();
          render(div({ dangerouslySetDom: element }));
        },
      };
    }
  );

  const [
    contentLoaderSlot,
    { load: loadResource, display: displayFile },
  ] = newSlot(
    "content-loader",
    loader<UriWithFragment, LinkedDataWithContent | LinkedDataWithBody>({
      fetcher: contentFetcherPassingUri,
      onLoaded: loadContent,
      contentSlot: contentOrDirSlot,
    })
  );

  const docsDirectorySlot = slot(
    "docs-directory",
    docsDirectory({
      searchDirectory: directoryIndex.search,
      searchWatchHistory,
    })
  );

  const [fileDropSlot, { handleDragEvent }] = newSlot(
    "file-drop",
    fileDrop({
      onFile: startChain((start) =>
        start
          .process(
            asyncMapWithErrorHandler(
              (it) => processFileToContent(it).then(contentSaver),
              (error) => console.error(error)
            )
          )
          .withEffect((start) =>
            start
              .map(pipe(pick("linkedData"), pick("@id"), newUriWithFragment))
              .handle(updateBrowserHistory)
          )
          .handle(displayFile)
      ),
    })
  );

  const [
    accountPickerSlot,
    { displayAccountPicker, closeAccountPicker },
  ] = newSlot(
    "account-picker",
    accountPicker({
      gdriveLogin: () => updateGdrive(["login"]),
    })
  );

  const containerView = createContainerView({
    navigationSlot: div({ dangerouslySetDom: navigationSlot }),
    contentOrDirSlot: contentLoaderSlot,
    fileDropSlot,
    accountPickerSlot,
    onDragenter: handleDragEvent,
  });

  const renderContainer = link(map(containerView), render);
  renderContainer();
  subscribeToSettings(updateDisplaySettings);
  startNav();

  const openPath = link(loadUriWithRecentFragment);
  onClose(browserPathProvider(openPath));
  onClose(documentLinksUriProvider(loadUri));
  onClose(stopNav);

  if (initialContent) {
    displayFile(initialContent);
  } else {
    openPath(currentUriWithFragment());
  }
};
