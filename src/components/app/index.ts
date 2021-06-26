import "./styles.css";
import "./loading.css";

import { ignore } from "linki";

import {
  LinkedDataWithContent,
  processFileToContent,
} from "../../functions/content-processors";
import { createProxyFetch, Fetch } from "../../functions/fetch-trough-proxy";
import { gdrive } from "../../functions/gdrive/controller";
import { getLastAccount, openGlobalDb } from "../../functions/global-db";
import {
  AnnotationsIndex,
  createAnnotationsIndex,
  createAnnotationsIndexer,
  createAnnotationsIndexStore,
} from "../../functions/indexes/annotations-index";
import { createCompositeIndexer } from "../../functions/indexes/composite-indexer";
import {
  createDirectoryIndex,
  createDirectoryIndexer,
  createDirectoryIndexStore,
  DirectoryIndex,
} from "../../functions/indexes/directory-index";
import { Indexer } from "../../functions/indexes/types";
import {
  createUrlIndex,
  createUrlIndexer,
  createUrlIndexStore,
  UrlIndex,
} from "../../functions/indexes/url-index";
import {
  createLinkedDataWithDocumentFetcher,
  LinkedDataWithContentFetcher,
} from "../../functions/linked-data-fetcher";
import { createStore } from "../../functions/store";
import { openRepository, RepositoryDb } from "../../functions/store/repository";
import {
  currentDocumentUriProvider,
  UriWithFragment,
} from "../../functions/url-hijack";
import { combine, fork, reduce, split } from "../../libs/connections";
import { defined, filter } from "../../libs/connections/filters";
import {
  head,
  map,
  mapAwait,
  mapTo,
  pick,
  to,
} from "../../libs/connections/mappers";
import { HashName } from "../../libs/hash";
import { filterState } from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import { div, fragment, newSlot } from "../../libs/simple-ui/render";
import { asyncLoader } from "../common/async-loader";
import { loader } from "../common/loader";
import { contentComponent } from "../content";
import { fileDrop } from "../file-drop";
import { navigation } from "../navigation";

const defaultUri = "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu";

const initServices = async (): Promise<{
  directoryIndex: DirectoryIndex;
  annotationsIndex: AnnotationsIndex;
  fetchTroughProxy: Fetch;
  urlIndex: UrlIndex;
  repositoryDb: RepositoryDb;
  indexLinkedData: Indexer;
}> => {
  const [repositoryDb] = await Promise.all([openRepository("first")]);
  const urlIndexStore = createUrlIndexStore(repositoryDb);
  const directoryIndexStore = createDirectoryIndexStore(repositoryDb);
  const annotationsIndexStore = createAnnotationsIndexStore(repositoryDb);
  const urlIndex = createUrlIndex(urlIndexStore);
  const urlIndexer = createUrlIndexer(urlIndexStore);

  const directoryIndex = createDirectoryIndex(directoryIndexStore);
  const directoryIndexer = createDirectoryIndexer(directoryIndexStore);

  const annotationsIndex = createAnnotationsIndex(annotationsIndexStore);
  const annotationsIndexer = createAnnotationsIndexer(annotationsIndexStore);

  const indexLinkedData = createCompositeIndexer([
    urlIndexer,
    directoryIndexer,
    annotationsIndexer,
  ]);

  return {
    fetchTroughProxy,
    directoryIndex,
    annotationsIndex,
    urlIndex,
    repositoryDb,
    indexLinkedData,
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
    directoryIndex,
    annotationsIndex,
    urlIndex,
    repositoryDb,
    indexLinkedData,
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

    const store = createStore(indexLinkedData, repositoryDb, (s) =>
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
      ),
      repositoryDb
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
        (it) => loadResource(it),
        map(
          pick("fragment"),
          filter(defined, (it) => goToFragment(it))
        )
      )
    );

    const [navigationSlot, { updateStoreState, updateGdriveState }] = newSlot(
      "navigation",
      navigation({
        updateGdrive,
        loadUri,
        directoryIndex,
      })
    );

    const contentFetcherPassingUri = createContentFetcherPassingUri(
      createLinkedDataWithDocumentFetcher(
        async (uri: string): Promise<HashName | undefined> => {
          const result = await urlIndex({ url: uri });
          if (result.length > 0) {
            return result[0].hash;
          }
        },
        fetchTroughProxy,
        store.readLinkedData,
        store.readResource
      )
    );

    const [contentSlot, { setCreator, displayContent, goToFragment }] = newSlot(
      "content-container",
      contentComponent({
        storeWrite: store.writeResource,
        ldStoreWrite: store.writeLinkedData,
        ldStoreRead: store.readLinkedData,
        annotationsIndex: annotationsIndex,
        onSave: ignore,
      })
    );

    const [
      contentLoaderSlot,
      { load: loadResource, display: displayFile },
    ] = newSlot(
      "content-loader",
      loader({
        fetcher: contentFetcherPassingUri,
        onLoaded: fork(displayContent, map(to(true), setContentReady)),
        contentSlot,
      })
    );

    const [fileDropSlot, { displayFileDrop }] = newSlot(
      "file-drop",
      fileDrop({
        onFile: mapAwait(processFileToContent, displayFile, (error) =>
          console.error(error)
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
          { id: "container", onDragenter: mapTo(true, displayFileDrop) },
          div({ class: "p-4" }, fileDropSlot, contentLoaderSlot)
        )
      )
    );
  }
);
