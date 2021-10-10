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
import type { UriWithFragment } from "../../functions/url-hijack";
import {
  documentLinksUriProvider,
  newUriWithFragment,
  pathToUri,
  updateBrowserHistory,
} from "../../functions/url-hijack";
import { browserPathProvider, currentPath } from "../../libs/browser-providers";
import type { HashName, HashUri } from "../../libs/hash";
import { isHashUri } from "../../libs/hash";
import { listDbs, storeGetAll } from "../../libs/indexeddb";
import { combine } from "../../libs/linki";
import {
  filterState,
  filterStates,
  handleState,
  newStateMapper,
} from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import type { Handlers, Slot, ViewSetup } from "../../libs/simple-ui/render";
import { div, newSlot, slot } from "../../libs/simple-ui/render";
import { AboutPage } from "../../pages/about";
import { accountPicker } from "../account-picker";
import { asyncLoader } from "../common/async-loader";
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

import { specialDirectoryUri } from "./special-uris";

const initServices = async (): Promise<{
  fetchTroughProxy: Fetch;
  globalDb: GlobalDb;
  unclaimedRepository: UnclaimedRepositoryDb;
  lastLogin: DriverAccount | undefined;
  initRepo: RepositoryDb;
  initialSettings: SettingsRecord[];
  sendAnalytics: AnalyticsSender;
  updateAnalyticsRepoAccount: UpdateAnalyticsRepoAccount;
}> => {
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
  onFileDrop: () => void;
}> = ({
  navigationSlot,
  contentOrDirSlot,
  accountPickerSlot,
  fileDropSlot,
  onFileDrop,
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
        onDragenter: onFileDrop,
      },
      fileDropSlot,
      accountPickerSlot,
      contentOrDirSlot
    )
  );

export const App = asyncLoader(
  measureAsyncTime("init", () => initServices()),
  ({
    fetchTroughProxy,
    globalDb,
    unclaimedRepository,
    lastLogin,
    initRepo,
    initialSettings,
    sendAnalytics,
    updateAnalyticsRepoAccount,
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
      combine<[GDriveState, StoreState]>(undefined, undefined),
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
        gdriveStateForAccountPicker
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
          if (it.uri === `${window.location.origin}/${specialDirectoryUri}`) {
            switchDisplayToDirectory();
          } else if (it.uri === `${window.location.origin}/about`) {
            renderAbout2();
          } else if (
            it.uri === window.location.origin ||
            it.uri === `${window.location.origin}/`
          ) {
            listDbs().then((list) => {
              list.length ? switchDisplayToDirectory() : renderAbout2();
            });
          } else {
            switchDisplayToContent();
            setCurrentUri(it.uri);
            loadResource(it);
          }
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
      },
    ] = newSlot(
      "navigation",
      navigation({
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
      })
    );

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
    const [contentSlot, { displayContent, goToFragment, setCreator }] = newSlot(
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

    const [
      contentLoaderSlot,
      { load: loadResource, display: displayFile },
    ] = newSlot(
      "content-loader",
      loader({
        fetcher: contentFetcherPassingUri,
        onLoaded: fork(displayContent, link(ignoreParam(), postDisplayHook)),
        contentSlot,
      })
    );

    const docsDirectorySlot = slot(
      "docs-directory",
      docsDirectory({
        searchDirectory: directoryIndex.search,
        searchWatchHistory,
      })
    );

    const [fileDropSlot, { displayFileDrop }] = newSlot(
      "file-drop",
      fileDrop({
        onFile: link(
          asyncMapWithErrorHandler(
            (it) => processFileToContent(it).then(contentSaver),
            (error) => console.error(error)
          ),
          fork(
            link(
              map(pipe(pick("linkedData"), pick("@id"), newUriWithFragment)),
              updateBrowserHistory
            ),
            (it) => {
              switchDisplayToContent();
              displayFile(it);
            }
          )
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

    const [
      contentOrDirSlot,
      { switchDisplayToContent, switchDisplayToDirectory, renderAbout },
    ] = newSlot(
      "either-content",
      (
        render
      ): Handlers<{
        switchDisplayToContent: void;
        switchDisplayToDirectory: void;
        renderAbout: void;
      }> => ({
        switchDisplayToContent: () => {
          render(); // clean previous dom, to force rerender
          render(div({ class: "mt-8" }, contentLoaderSlot));
        },
        switchDisplayToDirectory: () => {
          render(); // clean previous dom, to force rerender
          render(div({ class: "mt-8" }, docsDirectorySlot));
        },
        renderAbout: () => {
          render(AboutPage);
        },
      })
    );

    const renderAbout2 = fork(renderAbout, hideNavPermanently);

    const containerView = createContainerView({
      navigationSlot,
      contentOrDirSlot,
      fileDropSlot,
      accountPickerSlot,
      onFileDrop: link(map(to<true>(true)), displayFileDrop) as Callback<void>,
    });

    const renderContainer = link(map(containerView), render);
    renderContainer();
    subscribeToSettings(updateDisplaySettings);

    const openPath = link(map(pathToUri), loadUriWithRecentFragment);
    openPath(currentPath());
    onClose(browserPathProvider(openPath));
    onClose(documentLinksUriProvider(loadUri));
  }
);
