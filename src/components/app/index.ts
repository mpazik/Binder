import {
  asyncMapWithErrorHandler,
  Callback,
  defined,
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

import {
  LinkedDataWithContent,
  processFileToContent,
} from "../../functions/content-processors";
import { createContentSaver } from "../../functions/content-saver";
import { createProxyFetch, Fetch } from "../../functions/fetch-trough-proxy";
import { createGDrive } from "../../functions/gdrive";
import { gdrive, GDriveState } from "../../functions/gdrive/controller";
import {
  DriverAccount,
  getLastLogin,
  GlobalDb,
  openGlobalDb,
} from "../../functions/global-db";
import { createAnnotationsIndex } from "../../functions/indexes/annotations-index";
import { createCompositeIndexer } from "../../functions/indexes/composite-indexer";
import { createDirectoryIndex } from "../../functions/indexes/directory-index";
import {
  createSettingsIndexer,
  createSettingsStore,
  createSettingsSubscription,
  SettingsRecord,
  settingsStoreName,
} from "../../functions/indexes/settings-index";
import { createUriIndex } from "../../functions/indexes/url-index";
import {
  createWatchHistoryIndex,
  createWatchHistoryIndexer,
  createWatchHistorySearch,
  createWatchHistoryStore,
} from "../../functions/indexes/watch-history-index";
import {
  createLinkedDataWithDocumentFetcher,
  LinkedDataWithContentFetcher,
} from "../../functions/linked-data-fetcher";
import { RemoteDrive, RemoteDriverState } from "../../functions/remote-drive";
import { createStore } from "../../functions/store";
import {
  openAccountRepository,
  openUnclaimedRepository,
  RepositoryDb,
  UnclaimedRepositoryDb,
} from "../../functions/store/repository";
import {
  browserUriProvider,
  documentLinksUriProvider,
  newUriWithFragment,
  updateBrowserHistory,
  UriWithFragment,
} from "../../functions/url-hijack";
import { Consumer, stateProvider } from "../../libs/connections";
import { HashName, HashUri, isHashUri } from "../../libs/hash";
import { storeGetAll } from "../../libs/indexeddb";
import { newStateMapper } from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import {
  div,
  newSlot,
  Slot,
  slot,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { asyncLoader } from "../common/async-loader";
import { eitherComponent } from "../common/conditional-component";
import { loader } from "../common/loader";
import { contentComponent } from "../content";
import { docsDirectory } from "../directory";
import {
  fontFaceStyle,
  fontSizeStyle,
  lineHeightStyle,
  lineLengthStyle,
  Settings,
  themeProps,
} from "../display-settings";
import { DisplaySettings } from "../display-settings";
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

  return {
    fetchTroughProxy,
    globalDb,
    unclaimedRepository,
    lastLogin,
    initRepo,
    initialSettings,
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

const createContainerView: ViewSetup<
  {
    navigationSlot: Slot;
    contentOrDirSlot: Slot;
    fileDropSlot: Slot;
    onFileDrop: () => void;
  },
  DisplaySettings
> = ({ navigationSlot, contentOrDirSlot, fileDropSlot, onFileDrop }) => ({
  fontFace,
  fontSize,
  lineLength,
  lineHeight,
  theme,
}) =>
  div(
    { ...themeProps(theme) },
    navigationSlot,
    div(
      {
        id: "container",
        style: {
          ...fontFaceStyle(fontFace),
          ...fontSizeStyle(fontSize),
          ...lineLengthStyle(lineLength),
          ...lineHeightStyle(lineHeight),
        },
        onDragenter: onFileDrop,
      },
      div({ class: "p-4" }, fileDropSlot, contentOrDirSlot)
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
        (s) => updateStoreState(s)
      ),
      unclaimedRepository
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
    // todo this should be different
    const [creatorProvider, setCreator] = stateProvider<string | null>(
      lastLogin?.email ?? null
    );

    const updateGdrive = gdrive(
      fork(
        (state) => console.log("gdrive - ", state),
        (s) => updateGdriveState(s),
        link(
          map((state) => {
            if (state[0] === "logged" || state[0] === "disconnected") {
              console.log("switching user", state[1].user);
              return state[1].user.emailAddress;
            }
            if (state[0] === "signedOut") {
              return null;
            }
            return undefined;
          }),
          filter(defined),
          setCreator
        ),
        link(
          map(
            newStateMapper<GDriveState, RemoteDriverState>({
              idle: () => ["off"],
              loading: () => ["off"],
              signedOut: () => ["off"],
              disconnected: () => ["off"],
              loggingIn: () => ["loading"],
              profileRetrieving: () => ["loading"],
              logged: ({ config }) => {
                return ["on", createGDrive(config) as RemoteDrive];
              },
              loggingOut: () => ["off"],
              loadingError: () => ["off"],
              loggingInError: () => ["off"],
            })
          ),
          store.updateRemoteDriveState
        ),
        link(
          map((state) => {
            if (
              state[0] === "loading" ||
              state[0] === "logged" ||
              state[0] === "loggingIn" ||
              state[0] === "disconnected" ||
              state[0] === "signedOut"
            ) {
              return state[1].repository;
            }
            return undefined;
          }),
          filter(defined),
          passOnlyChanged<RepositoryDb>(initRepo),
          fork(updateRepo, () => switchDisplayToDirectory())
        )
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
          if (it.uri === specialDirectoryUri) {
            switchDisplayToDirectory();
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
      { updateStoreState, updateGdriveState, hideNav, setCurrentUri },
    ] = newSlot(
      "navigation",
      navigation({
        updateGdrive,
        upload: store.upload,
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
    const [contentSlot, { displayContent, goToFragment }] = newSlot(
      "content-container",
      contentComponent({
        contentSaver,
        ldStoreWrite: store.writeLinkedData,
        ldStoreRead: store.readLinkedData,
        annotationsIndex: annotationsIndex.search,
        onSave: ignore,
        onDisplay: postDisplayHook,
        creatorProvider,
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
            (it) => displayFile(it)
          )
        ),
      })
    );

    onClose(documentLinksUriProvider(loadUri));
    onClose(
      browserUriProvider({ defaultUri: specialDirectoryUri })(
        loadUriWithRecentFragment
      )
    );

    const [
      contentOrDirSlot,
      { renderA: switchDisplayToContent, renderB: switchDisplayToDirectory },
    ] = newSlot(
      "either-content",
      eitherComponent({ slotA: contentLoaderSlot, slotB: docsDirectorySlot })
    );

    const containerView = createContainerView({
      navigationSlot,
      contentOrDirSlot,
      fileDropSlot,
      onFileDrop: link(map(to<true>(true)), displayFileDrop) as Consumer<void>,
    });

    const renderContainer = link(map(containerView), render);
    subscribeToSettings(renderContainer);
  }
);
