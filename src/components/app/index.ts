import "./styles.css";
import "./loading.css";

import {
  ArticleContentFetcher,
  createArticleContentFetcher,
} from "../../functions/article-content-fetcher";
import {
  ArticleLdFetcher,
  createArticleLdFetcher,
} from "../../functions/article-ld-fetcher";
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
import { createStore, StoreState } from "../../functions/store";
import { Consumer, dataPortal, map, Provider } from "../../libs/connections";
import { HashName } from "../../libs/hash";
import { getHash } from "../../libs/linked-data";
import { measureAsyncTime } from "../../libs/performance";
import { div, slot } from "../../libs/simple-ui/render";
import { articleComponent } from "../article";
import { asyncLoader } from "../common/async-loader";
import { fileNavigation } from "../navigation";
import { profilePanel } from "../profile";

const initDb = async (): Promise<{
  articleLdFetcher: ArticleLdFetcher;
  articleContentFetcher: ArticleContentFetcher;
  directoryIndex: DirectoryIndex;
  gdriveStateConsumer: Consumer<GDriveState>;
  storeStateProvider: Provider<StoreState>;
}> => {
  const [gdriveStateProvider, gdriveStateConsumer] = dataPortal<GDriveState>();
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

  const articleContentFetcher = createArticleContentFetcher(store.readResource);

  const getHash = async (uri: string): Promise<HashName | undefined> => {
    const result = await urlIndex({ url: uri });
    if (result.length > 0) {
      return result[0].hash;
    }
  };
  const articleLdFetcher = createArticleLdFetcher(
    getHash,
    store.readLinkedData,
    store.writeLinkedData,
    store.writeResource
  );

  return {
    articleLdFetcher,
    articleContentFetcher,
    directoryIndex,
    gdriveStateConsumer,
    storeStateProvider: store.storeStateProvider,
  };
};

export const App = asyncLoader(
  measureAsyncTime("init", initDb),
  ({
    articleContentFetcher,
    articleLdFetcher,
    directoryIndex,
    gdriveStateConsumer,
    storeStateProvider,
  }) => (render) => {
    const [articleHashProvider, articleHash] = dataPortal<HashName>();
    render(
      div(
        div(
          { id: "navigation" },
          slot(
            "profile",
            profilePanel({ gdriveStateConsumer, storeStateProvider })
          ),
          slot(
            "content-nav",
            fileNavigation({
              directoryIndex,
              hashProvider: articleHashProvider,
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
                articleLdFetcher,
                onArticleLoaded: map(getHash)(articleHash),
                contentFetcher: articleContentFetcher,
              })
            )
          )
        )
      )
    );
  }
);
