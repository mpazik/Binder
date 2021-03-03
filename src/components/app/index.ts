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
import { currentDocumentUriProvider } from "../../functions/url-hijack";
import { Consumer, dataPortal, Provider } from "../../libs/connections";
import { withDefaultValue } from "../../libs/connections/processors2";
import { HashName, HashUri } from "../../libs/hash";
import { measureAsyncTime } from "../../libs/performance";
import { div, slot } from "../../libs/simple-ui/render";
import { articleComponent } from "../article";
import { asyncLoader } from "../common/async-loader";
import { fileNavigation } from "../navigation";
import { searchBox } from "../navigation/search-box";
import { profilePanel } from "../profile";

const initServices = async (): Promise<{
  contentFetcher: LinkedDataWithDocumentFetcher;
  directoryIndex: DirectoryIndex;
  gdriveStateConsumer: Consumer<GDriveState>;
  storeStateProvider: Provider<StoreState>;
  storeWrite: ResourceStoreWrite;
  ldStoreWrite: LinkedDataStoreWrite;
}> => {
  const [gdriveStateProvider, gdriveStateConsumer] = dataPortal<GDriveState>();
  const fetchTroughProxy = createProxyFetch();
  const [urlIndexDb, directoryIndexDb] = await Promise.all([
    createUrlIndexDb(),
    createDirectoryIndexDb(),
  ]);
  const urlIndex = createUrlIndex(urlIndexDb);
  const urlIndexer = createUrlIndexer(urlIndexDb);

  const directoryIndex = createDirectoryIndex(directoryIndexDb);
  const directoryIndexer = createDirectoryIndexer(directoryIndexDb);
  const indexLinkedData = createCompositeIndexer([
    urlIndexer,
    directoryIndexer,
  ]);

  const store = await createStore(indexLinkedData);
  gdriveStateProvider((state) => store.updateGdriveState(state));

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
    gdriveStateConsumer,
    storeStateProvider: store.storeStateProvider,
    storeWrite: store.writeResource,
    ldStoreWrite: store.writeLinkedData,
  };
};

export const App = asyncLoader(
  measureAsyncTime("init", initServices),
  ({
    contentFetcher,
    directoryIndex,
    gdriveStateConsumer,
    storeStateProvider,
    storeWrite,
    ldStoreWrite,
  }) => (render, onClose) => {
    const [selectedItemProvider, selectItem] = dataPortal<
      HashUri | undefined
    >();

    const [uriProvider, updateUri] = dataPortal<string>();

    render(
      div(
        div(
          { id: "navigation" },
          slot(
            "profile",
            profilePanel({ gdriveStateConsumer, storeStateProvider })
          ),
          searchBox((url) => updateUri(url.toString())),
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
                contentFetcher,
                storeWrite,
                ldStoreWrite,
                uriProvider,
                onArticleLoaded: (linkedData) =>
                  selectItem(linkedData["@id"] as HashUri),
              })
            )
          )
        )
      )
    );

    currentDocumentUriProvider(
      onClose,
      withDefaultValue(
        "https://pl.wikipedia.org/wiki/Dedal_z_Sykionu" as string,
        updateUri
      )
    );
  }
);
