import type { Callback } from "linki";
import {
  asyncMapWithErrorHandler,
  defined,
  definedTuple,
  filter,
  fork,
  ignore,
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
import type { JsonHtml } from "linki-ui";
import {
  mountComponent,
  renderJsonHtmlToDom,
  createComponentRenderer,
} from "linki-ui";

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
import { createCompletionIndex } from "../../functions/indexes/completion-index";
import { createCompositeIndexer } from "../../functions/indexes/composite-indexer";
import { createDirectoryIndex } from "../../functions/indexes/directory-index";
import { createHabitIndex } from "../../functions/indexes/habit-index";
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
import type { UriWithFragment } from "../../libs/browser-providers";
import {
  browserPathProvider,
  currentUriWithFragment,
  newUriWithFragment,
  updateBrowserHistory,
} from "../../libs/browser-providers";
import type { Day } from "../../libs/calendar-ld";
import { dayType, getTodayUri } from "../../libs/calendar-ld";
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
  ComponentBody,
  Handlers,
  Slot,
  ViewSetup,
} from "../../libs/simple-ui/render";
import { div, newSlot } from "../../libs/simple-ui/render";
import { accountPicker } from "../account-picker";
import { createAnnotationSaverWithContext } from "../annotations/service";
import { dropdown } from "../common/drop-down-linki-ui";
import { loader } from "../common/loader";
import { contentComponent } from "../content";
import { docsDirectory } from "../directory";
import type { Settings } from "../display-settings";
import { updateDisplaySettings } from "../display-settings";
import {
  settingsIcon,
  setupDisplaySettingsPanel,
} from "../display-settings/panel";
import { createSettingUpdateAction } from "../display-settings/setting-update";
import { fileDrop } from "../file-drop";
import { dayJournal } from "../journal";
import { navigation } from "../navigation";
import { storePage } from "../store";

import { specialTodayUri } from "./special-uris";

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
  const completionIndex = createCompletionIndex();
  const habitsIndex = createHabitIndex();
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
    annotationsIndex.update((it) => store.readLinkedData(it)),
    createWatchHistoryIndexer(watchHistoryStore, (hash) =>
      store.removeLinkedData(hash)
    ),
    createSettingsIndexer(
      settingsStore,
      (hash) => store.removeLinkedData(hash),
      updateSettings
    ),
    completionIndex.update,
    habitsIndex.update,
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
    switchRepoForSettings,
    completionIndex.switchRepo,
    habitsIndex.switchRepo
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
    (it) => setCreatorForAnnotations(it ?? undefined)
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
        fork(updateRepo, () => displayJsonHtml(docsDirectorySlot))
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

  const loadUri: Callback<UriWithFragment> = link(
    reduce<UriWithFragment & { uriChanged: boolean }, UriWithFragment>(
      (old, { uri, fragment }) => ({
        uri,
        fragment,
        uriChanged: uri !== old.uri,
      }),
      { uri: "", uriChanged: false }
    ),
    link(
      split<UriWithFragment & { uriChanged: boolean }>((it) => it.uriChanged),
      [
        (it: UriWithFragment) => {
          setCurrentUri(it.uri);
          loadResource(it);
        },
        link(
          map<UriWithFragment, string | undefined>(pick("fragment")),
          filter(defined),
          fork(
            (it) => goToFragment(it),
            () => hideNav()
          )
        ),
      ]
    )
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

  const saveLinkedData: Callback<LinkedData> = (ld) =>
    store
      .writeLinkedData(ld)
      .catch((error) => console.error("Filed saving lined data", error));

  const createDisplaySettingUpdater = <T extends keyof Settings>(
    key: T
  ): ((value: Settings[T]) => void) =>
    link(
      map((it: Settings[T]) => createSettingUpdateAction(key, it)),
      saveLinkedData
    );

  const loadUriWithHistoryUpdate = fork(updateBrowserHistory, loadUri);
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
  ] = mountComponent(
    navigation({
      displayed:
        !initialContent || getType(initialContent.linkedData) != "AboutPage",
      initProfile: {
        repository: initRepo,
        user: lastLogin
          ? {
              emailAddress: lastLogin.email,
              displayName: lastLogin.name,
            }
          : undefined,
      },
      searchDirectory: directoryIndex.search,
      searchWatchHistory,
      displaySettingsSlot: dropdown({
        icon: settingsIcon,
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
    }),
    {
      updateGdrive,
      upload: store.upload,
      loadUri: loadUriWithHistoryUpdate,
      displayAccountPicker: () => displayAccountPicker({ loading: false }),
    }
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

  const {
    saveAnnotation,
    setCreator: setCreatorForAnnotations,
  } = createAnnotationSaverWithContext({
    saveAnnotation: saveLinkedData,
  });

  const contentSaver = createContentSaver(
    store.writeResource,
    store.writeLinkedData
  );
  const [contentSlot, { displayContent, goToFragment }] = newSlot(
    "content-container",
    contentComponent({
      contentSaver,
      saveLinkedData,
      ldStoreRead: store.readLinkedData,
      onSave: ignore,
      onDisplay: hideNav,
      saveAnnotation,
      annotationSubscribe: annotationsIndex.subscribe(store.readLinkedData),
      loadUri,
    })
  );

  const loadContent = (data: LinkedDataWithContent | LinkedDataWithBody) => {
    const dataType = getType(data.linkedData);
    if (dataType === "SearchResultsPage" || dataType === "NotFoundPage") {
      displayJsonHtml(docsDirectorySlot);
    } else if (
      dataType === "Page" &&
      data.linkedData.name === "Docland - Store"
    ) {
      displayJsonHtml(
        storePage({
          writeLinkedData: store.writeLinkedData,
          realAllLinkedData: store.readAllLinkedData,
        })
      );
    } else if (dataType === "AboutPage") {
      if (isLinkedDataWithBody(data)) {
        displayFullScreen(data.body);
      } else {
        (async () => {
          const dom = await measureAsyncTime("parse", () =>
            blobToDocument(data.content)
          );
          displayFullScreen(dom.body);
        })();
      }
    } else if (dataType === dayType) {
      const [component] = mountComponent(
        dayJournal({
          day: data.linkedData as Day,
          annotationSubscribe: annotationsIndex.subscribe(store.readLinkedData),
          saveAnnotation,
          saveLinkedData,
          searchCompletionIndex: completionIndex.searchIndex,
          subscribeHabits: habitsIndex.subscribe(store.readLinkedData),
          subscribeCompletable: completionIndex.subscribe(store.readLinkedData),
          loadUri,
        })
      );
      displayJsonHtml(component);
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
      displaySlot(contentSlot);
      displayContent(linkedDataWithContent);
      setContentReady(true);
      pushCreator();
    }
  };

  const [
    contentOrDirSlot,
    { displayJsonHtml, displayFullScreen, displaySlot },
  ] = newSlot(
    "either-content",
    (
      render
    ): Handlers<{
      displaySlot: Slot;
      displayJsonHtml: JsonHtml;
      displayFullScreen: Node;
    }> => {
      const runtime: ComponentBody<{ pushJsonHtml: JsonHtml }> = (
        render,
        onClose
      ) => {
        const parent = document.createElement("div");
        const renderJsonHtml = createComponentRenderer(parent);
        onClose(() => {
          parent.dispatchEvent(new CustomEvent("disconnected"));
        });
        render(
          div({
            dangerouslySetDom: parent,
          })
        );
        return {
          pushJsonHtml: renderJsonHtml,
        };
      };
      const [slot, { pushJsonHtml }] = newSlot("jsonHtml", runtime);
      return {
        displaySlot: (slot) => {
          render(); // clean previous dom, to force rerender
          render(div({ class: "mt-8 ml-2 mr-2" }, slot));
          hideNav();
        },
        displayJsonHtml: (jsonHtml) => {
          render(); // clean previous dom, to force rerender
          render(div({ class: "mt-8 ml-2 mr-2" }, slot));
          pushJsonHtml(jsonHtml);
          hideNav();
        },
        displayFullScreen: (element) => {
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

  const [docsDirectorySlot] = mountComponent(
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
  ] = mountComponent(accountPicker, {
    gdriveLogin: () => updateGdrive(["login"]),
  });

  const containerView = createContainerView({
    navigationSlot: div({
      dangerouslySetDom: renderJsonHtmlToDom(navigationSlot),
    }),
    contentOrDirSlot: contentLoaderSlot,
    fileDropSlot,
    accountPickerSlot: div({
      dangerouslySetDom: renderJsonHtmlToDom(accountPickerSlot),
    }),
    onDragenter: handleDragEvent,
  });

  const renderContainer = link(map(containerView), render);
  renderContainer();
  subscribeToSettings(updateDisplaySettings);
  startNav();

  const openPath = link(
    split(({ uri }) => uri === specialTodayUri),
    [
      link(map(to(getTodayUri), newUriWithFragment), loadUriWithHistoryUpdate),
      loadUriWithRecentFragment,
    ]
  );
  onClose(browserPathProvider(openPath));
  onClose(stopNav);

  if (initialContent) {
    displayFile(initialContent);
  } else {
    openPath(currentUriWithFragment());
  }
};
