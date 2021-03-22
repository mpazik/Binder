import "./styles.css";
import "./loading.css";

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
import { updateBrowserHistory } from "../../functions/url-hijack";
import { fork } from "../../libs/connections";
import { map, mapTo, pick } from "../../libs/connections/mappers";
import { HashName, HashUri } from "../../libs/hash";
import { filterState } from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import { div, newSlot } from "../../libs/simple-ui/render";
import { articleComponent } from "../article";
import { asyncLoader } from "../common/async-loader";
import { fileDrop } from "../file-drop";
import { fileNavigation } from "../navigation";
import { searchBox } from "../navigation/search-box";
import { profilePanel } from "../profile";

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
  }) => (render) => {
    const [profilePanelSlot, { updateStoreState, updateGdriveState }] = newSlot(
      "profile",
      profilePanel()
    );

    const store = createStore(
      indexLinkedData,
      localStoreDb,
      synchDb,
      updateStoreState
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

    const [contentSlot, { setUserEmail, setUri, provideFile }] = newSlot(
      "content",
      articleComponent({
        documentAnnotationsIndex,
        contentFetcher,
        storeWrite: store.writeResource,
        ldStoreWrite: store.writeLinkedData,
        ldStoreRead: store.readLinkedData,
        onArticleLoaded: (linkedData) =>
          selectItem(linkedData["@id"] as HashUri),
      })
    );

    const [fileDropSlot, { displayFileDrop }] = newSlot(
      "file-drop",
      fileDrop({ onFile: provideFile })
    );

    const updateGdrive = gdrive(
      fork(
        updateGdriveState,
        map(
          pick("state"),
          fork(
            filterState(
              "logged",
              map(pick("user"), map(pick("emailAddress"), setUserEmail))
            ),
            store.updateGdriveState
          )
        )
      )
    );

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
            map((url) => url.toString(), fork(updateBrowserHistory, setUri))
          ),
          contentNavSlot
        ),
        div({ id: "container" }, div({ class: "p-4" }, contentSlot))
      )
    );
  }
);
