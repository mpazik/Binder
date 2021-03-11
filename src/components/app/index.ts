import "./styles.css";
import "./loading.css";

import { createProxyFetch } from "../../functions/fetch-trough-proxy";
import { GDriveState } from "../../functions/gdrive/controller";
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
import {
  createUrlIndex,
  createUrlIndexDb,
  createUrlIndexer,
} from "../../functions/indexes/url-index";
import {
  createLinkedDataWithDocumentFetcher,
  LinkedDataWithDocumentFetcher,
} from "../../functions/linked-data-fetcher";
import {
  createStore,
  LinkedDataStoreWrite,
  ResourceStoreWrite,
  StoreState,
} from "../../functions/store";
import { LinkedDataStoreRead } from "../../functions/store/local-store";
import { currentDocumentUriProvider } from "../../functions/url-hijack";
import { Consumer, dataPortal, fork, Provider } from "../../libs/connections";
import { mapTo, pluck } from "../../libs/connections/processors2";
import { HashName, HashUri } from "../../libs/hash";
import { filterState } from "../../libs/named-state";
import { measureAsyncTime } from "../../libs/performance";
import { div, slot } from "../../libs/simple-ui/render";
import { articleComponent } from "../article";
import { asyncLoader } from "../common/async-loader";
import { fileDrop } from "../file-drop";
import { fileNavigation } from "../navigation";
import { searchBox } from "../navigation/search-box";
import { profilePanel } from "../profile";
import { CloseHandler } from "../../libs/connections/types";

const initServices = async (): Promise<{
  contentFetcher: LinkedDataWithDocumentFetcher;
  directoryIndex: DirectoryIndex;
  documentAnnotationsIndex: DocumentAnnotationsIndex;
  onGDriveState: Consumer<GDriveState>;
  storeStateProvider: Provider<StoreState>;
  storeWrite: ResourceStoreWrite;
  ldStoreWrite: LinkedDataStoreWrite;
  ldStoreRead: LinkedDataStoreRead;
}> => {
  const fetchTroughProxy = createProxyFetch();
  const [
    urlIndexDb,
    directoryIndexDb,
    documentAnnotationsDb,
  ] = await Promise.all([
    createUrlIndexDb(),
    createDirectoryIndexDb(),
    createDocumentAnnotationsIndexDb(),
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

  const store = await createStore(indexLinkedData);

  const getHash = async (uri: string): Promise<HashName | undefined> => {
    const result = await urlIndex({ url: uri });
    if (result.length > 0) {
      return result[0].hash;
    }
  };
  const contentFetcher = createLinkedDataWithDocumentFetcher(
    getHash,
    await fetchTroughProxy,
    store.readLinkedData,
    store.readResource
  );

  return {
    contentFetcher,
    directoryIndex,
    onGDriveState: (state) => store.updateGdriveState(state),
    documentAnnotationsIndex,
    storeStateProvider: store.storeStateProvider,
    storeWrite: store.writeResource,
    ldStoreWrite: store.writeLinkedData,
    ldStoreRead: store.readLinkedData,
  };
};

export const App = asyncLoader(
  measureAsyncTime("init", () => initServices()),
  ({
    contentFetcher,
    directoryIndex,
    documentAnnotationsIndex,
    onGDriveState,
    storeStateProvider,
    storeWrite,
    ldStoreWrite,
    ldStoreRead,
  }) => (render, onClose) => {
    const [selectedItemProvider, selectItem] = dataPortal<
      HashUri | undefined
    >();

    const [uriProvider, setUri] = dataPortal<string>();
    const [navigationUriProvider, setNavigationUri] = dataPortal<string>();
    const [userEmailProvider, setUserEmail] = dataPortal<string>();
    const [displayProvider, displayFileDrop] = dataPortal<boolean>();
    const [fileProvider, fileConsumer] = dataPortal<Blob>();

    render(
      div(
        {
          onDragenter: mapTo(true, displayFileDrop),
        },
        slot("file-drop", fileDrop({ fileConsumer, displayProvider })),
        div(
          { id: "navigation" },
          slot(
            "profile",
            profilePanel({
              gdriveStateConsumer: fork(
                onGDriveState,
                filterState(
                  "logged",
                  pluck("user", pluck("emailAddress", setUserEmail))
                )
              ),
              storeStateProvider,
            })
          ),
          searchBox((url) => setNavigationUri(url.toString())),
          slot(
            "content-nav",
            fileNavigation({
              directoryIndex,
              selectedItemProvider,
            })
          )
        ),
        div(
          { id: "container" },
          div(
            { class: "p-4" },
            slot(
              "content",
              articleComponent({
                userEmailProvider,
                documentAnnotationsIndex,
                contentFetcher,
                storeWrite,
                ldStoreWrite,
                ldStoreRead,
                uriProvider,
                fileProvider,
                onArticleLoaded: (linkedData) =>
                  selectItem(linkedData["@id"] as HashUri),
              })
            )
          )
        )
      )
    );

    currentDocumentUriProvider({
      extraProvider: navigationUriProvider,
      defaultUri: "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu",
    })(onClose, setUri);
  }
);
