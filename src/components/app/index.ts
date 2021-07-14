import "./styles.css";
import "./loading.css";

import {
  asyncMapWithErrorHandler,
  defined,
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
import { createUriIndex } from "../../functions/indexes/url-index";
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
  currentDocumentUriProvider,
  newUriWithFragment,
  updateBrowserHistory,
  UriWithFragment,
} from "../../functions/url-hijack";
import { stateProvider } from "../../libs/connections";
import { HashName } from "../../libs/hash";
import { newStateMapper } from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import { div, fragment, newSlot } from "../../libs/simple-ui/render";
import { asyncLoader } from "../common/async-loader";
import { loader } from "../common/loader";
import { contentComponent } from "../content";
import { fileDrop } from "../file-drop";
import { navigation } from "../navigation";

const defaultUri = "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu";

const initServices = async (): Promise<{
  fetchTroughProxy: Fetch;
  globalDb: GlobalDb;
  unclaimedRepository: UnclaimedRepositoryDb;
  lastLogin: DriverAccount | undefined;
  lastLoginRepo: RepositoryDb | undefined;
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

  return {
    fetchTroughProxy,
    globalDb,
    unclaimedRepository,
    lastLogin,
    lastLoginRepo,
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

export const App = asyncLoader(
  measureAsyncTime("init", () => initServices()),
  ({
    fetchTroughProxy,
    globalDb,
    unclaimedRepository,
    lastLogin,
    lastLoginRepo,
  }) => (render, onClose) => {
    const urlIndex = createUriIndex();
    const directoryIndex = createDirectoryIndex();
    const annotationsIndex = createAnnotationsIndex();
    const indexLinkedData = createCompositeIndexer([
      urlIndex.update,
      directoryIndex.update,
      annotationsIndex.update,
    ]);
    const store = createStore(
      indexLinkedData,
      fork(
        (state) => console.log("store - ", state),
        (s) => updateStoreState(s)
      )
    );
    const updateRepo = fork(
      () => console.log("switching repo"),
      store.switchRepo,
      urlIndex.switchRepo,
      directoryIndex.switchRepo,
      annotationsIndex.switchRepo
    );
    const initRepo = lastLoginRepo ?? unclaimedRepository;
    updateRepo(initRepo);

    // todo this should be different
    const [creatorProvider, setCreator] = stateProvider(lastLogin?.email);

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
              error: () => ["off"],
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
          updateRepo
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
        (it: UriWithFragment) => loadResource(it),
        link(
          map<UriWithFragment, string | undefined>(pick("fragment")),
          filter(defined),
          (it) => goToFragment(it)
        ),
      ])
    );

    const [navigationSlot, { updateStoreState, updateGdriveState }] = newSlot(
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
        loadUri,
        directoryIndex: directoryIndex.search,
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
        onLoaded: displayContent,
        contentSlot,
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

    currentDocumentUriProvider({
      defaultUri,
    })(onClose, loadUri);

    render(
      fragment(
        navigationSlot,
        div(
          {
            id: "container",
            onDragenter: link(map(to<true>(true)), displayFileDrop),
          },
          div({ class: "p-4" }, fileDropSlot, contentLoaderSlot)
        )
      )
    );
  }
);
