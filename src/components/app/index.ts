import "./styles.css";
import "./loading.css";

import {
  LinkedDataWithContent,
  processFileToContent,
} from "../../functions/content-processors";
import { createProxyFetch, Fetch } from "../../functions/fetch-trough-proxy";
import { gdrive } from "../../functions/gdrive/controller";
import { createCompositeIndexer } from "../../functions/indexes/composite-indexer";
import {
  createDirectoryIndex,
  createDirectoryIndexDb,
  createDirectoryIndexer,
  DirectoryIndex,
} from "../../functions/indexes/directory-index";
import {
  createDocumentAnnotationsIndex,
  createDocumentAnnotationsIndexDb,
  createDocumentAnnotationsIndexer,
  DocumentAnnotationsIndex,
} from "../../functions/indexes/document-annotations-index";
import { Indexer } from "../../functions/indexes/types";
import {
  createUrlIndex,
  createUrlIndexDb,
  createUrlIndexer,
  UrlIndex,
} from "../../functions/indexes/url-index";
import { createLinkedDataWithDocumentFetcher } from "../../functions/linked-data-fetcher";
import { createStore, createSyncDb, SyncDb } from "../../functions/store";
import {
  createLocalStoreDb,
  LocalStoreDb,
} from "../../functions/store/local-store";
import {
  currentDocumentUriProvider,
  newUriWithFragment,
  updateBrowserHistory,
  UriWithFragment,
} from "../../functions/url-hijack";
import {
  combine,
  fork,
  reduce,
  split,
  withMultiState,
} from "../../libs/connections";
import { defined, filter } from "../../libs/connections/filters";
import {
  head,
  map,
  mapAwait,
  mapTo,
  pick,
  to,
} from "../../libs/connections/mappers";
import { HashName, HashUri } from "../../libs/hash";
import { filterState } from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import { div, newSlot } from "../../libs/simple-ui/render";
import { asyncLoader } from "../common/async-loader";
import { loader } from "../common/loader";
import { contentComponent } from "../content";
import { fileDrop } from "../file-drop";
import { fileNavigation } from "../navigation";
import { searchBox } from "../navigation/search-box";
import { profilePanel } from "../profile";

const defaultUri = "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu";

const initServices = async (): Promise<{
  directoryIndex: DirectoryIndex;
  documentAnnotationsIndex: DocumentAnnotationsIndex;
  fetchTroughProxy: Fetch;
  urlIndex: UrlIndex;
  localStoreDb: LocalStoreDb;
  synchDb: SyncDb;
  indexLinkedData: Indexer;
}> => {
  const [
    urlIndexDb,
    directoryIndexDb,
    documentAnnotationsDb,
    localStoreDb,
    synchDb,
  ] = await Promise.all([
    createUrlIndexDb(),
    createDirectoryIndexDb(),
    createDocumentAnnotationsIndexDb(),
    createLocalStoreDb(),
    createSyncDb(),
  ]);
  const urlIndex = createUrlIndex(urlIndexDb);
  const urlIndexer = createUrlIndexer(urlIndexDb);

  const directoryIndex = createDirectoryIndex(directoryIndexDb);
  const directoryIndexer = createDirectoryIndexer(directoryIndexDb);

  const documentAnnotationsIndex = createDocumentAnnotationsIndex(
    documentAnnotationsDb
  );
  const documentAnnotationsIndexer = createDocumentAnnotationsIndexer(
    documentAnnotationsDb
  );

  const indexLinkedData = createCompositeIndexer([
    urlIndexer,
    directoryIndexer,
    documentAnnotationsIndexer,
  ]);

  return {
    fetchTroughProxy: await createProxyFetch(),
    directoryIndex,
    documentAnnotationsIndex,
    urlIndex,
    localStoreDb,
    synchDb,
    indexLinkedData,
  };
};

export const App = asyncLoader(
  measureAsyncTime("init", () => initServices()),
  ({
    fetchTroughProxy,
    directoryIndex,
    documentAnnotationsIndex,
    urlIndex,
    localStoreDb,
    indexLinkedData,
    synchDb,
  }) => (render, onClose) => {
    const [setUserEmail, setContentReady] = combine<[string | null, boolean]>(
      filter(
        (v): v is [string, true] => Boolean(v[0] && v[1]),
        map(head, (user) => {
          setCreator(user);
        })
      ),
      null,
      false
    );

    const store = createStore(indexLinkedData, localStoreDb, synchDb, (s) =>
      updateStoreState(s)
    );

    const updateGdrive = gdrive(
      fork(
        (s) => updateGdriveState(s),
        filterState(
          "logged",
          map(pick("user"), map(pick("emailAddress"), setUserEmail))
        ),
        store.updateGdriveState
      )
    );

    const [profilePanelSlot, { updateStoreState, updateGdriveState }] = newSlot(
      "profile",
      profilePanel({
        login: () => updateGdrive(["login"]),
        logout: () => updateGdrive(["logout"]),
      })
    );

    const contentFetcher = createLinkedDataWithDocumentFetcher(
      async (uri: string): Promise<HashName | undefined> => {
        const result = await urlIndex({ url: uri });
        if (result.length > 0) {
          return result[0].hash;
        }
      },
      fetchTroughProxy,
      store.readLinkedData,
      store.readResource
    );

    const [contentNavSlot, { selectItem }] = newSlot(
      "content-nav",
      fileNavigation({
        directoryIndex,
      })
    );

    const [contentSlot, { setCreator, displayContent, goToFragment }] = newSlot(
      "content",
      contentComponent({
        storeWrite: store.writeResource,
        ldStoreWrite: store.writeLinkedData,
        ldStoreRead: store.readLinkedData,
        documentAnnotationsIndex,
        onSave: (linkedData) => selectItem(linkedData["@id"] as HashUri),
      })
    );

    const [displayContentWithFragment, [setFragment]] = withMultiState<
      [string | undefined],
      LinkedDataWithContent
    >(([fragment], content) => {
      displayContent({ fragment, ...content });
    }, undefined);

    const [
      contentLoaderSlot,
      { load: loadResource, display: displayFile },
    ] = newSlot(
      "content-loader",
      loader({
        fetcher: contentFetcher,
        onLoaded: fork(
          map(pick("linkedData"), (linkedData) =>
            selectItem(linkedData["@id"] as HashUri)
          ),
          displayContentWithFragment,
          map(to(true), setContentReady)
        ),
        contentSlot,
      })
    );

    const [fileDropSlot, { displayFileDrop }] = newSlot(
      "file-drop",
      fileDrop({
        onFile: mapAwait(
          processFileToContent,
          fork(map(to(undefined), setFragment), displayFile),
          (error) => {
            console.error(error);
          }
        ),
      })
    );

    const loadUri = reduce<
      UriWithFragment & { uriChanged: boolean },
      UriWithFragment
    >(
      { uri: "", uriChanged: false },
      (old, { uri, fragment }) => ({
        uri,
        fragment,
        uriChanged: uri !== old.uri,
      }),
      split(
        pick("uriChanged"),
        ({ uri, fragment }) => {
          setFragment(fragment);
          loadResource(uri);
        },
        map(pick("fragment"), filter(defined, goToFragment))
      )
    );

    currentDocumentUriProvider({
      defaultUri,
    })(onClose, loadUri);

    render(
      div(
        {
          onDragenter: mapTo(true, displayFileDrop),
        },
        fileDropSlot,
        div(
          {
            id: "navigation",
            onDisplay: () => {
              updateGdrive(["load"]);
            },
          },
          profilePanelSlot,
          searchBox(
            map(
              (url) => newUriWithFragment(url.toString()),
              fork(updateBrowserHistory, loadUri)
            )
          ),
          contentNavSlot
        ),
        div({ id: "container" }, div({ class: "p-4" }, contentLoaderSlot))
      )
    );
  }
);
