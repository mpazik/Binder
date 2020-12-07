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
  createLocalStoreDb,
  createLocalStoreRead,
  createLocalStoreWrite,
} from "../../functions/local-store";
import { dataPortal, map } from "../../libs/connections";
import { HashName } from "../../libs/hash";
import { getHash } from "../../libs/linked-data";
import { measureAsyncTime } from "../../libs/performance";
import { div, slot } from "../../libs/simple-ui/render";
import { articleComponent } from "../article-component";
import { asyncLoader } from "../common/async-loader";
import { fileNavigation } from "../navigation";
import { profilePanel } from "../profile";

const initDb = async (): Promise<{
  articleLdFetcher: ArticleLdFetcher;
  articleContentFetcher: ArticleContentFetcher;
  directoryIndex: DirectoryIndex;
}> => {
  const localStoreDb = await createLocalStoreDb();
  const localStoreRead = createLocalStoreRead(localStoreDb);
  const localStoreWrite = createLocalStoreWrite(localStoreDb);

  const [urlIndexDb, directoryIndexDb] = await Promise.all([
    createUrlIndexDb(localStoreDb),
    createDirectoryIndexDb(localStoreDb),
  ]);
  const urlIndex = createUrlIndex(urlIndexDb);
  const urlIndexer = createUrlIndexer(urlIndexDb);

  const directoryIndex = createDirectoryIndex(directoryIndexDb);
  const directoryIndexer = createDirectoryIndexer(directoryIndexDb);
  const indexLinkedData = createCompositeIndexer([
    urlIndexer,
    directoryIndexer,
  ]);

  const articleContentFetcher = createArticleContentFetcher(localStoreRead);

  const getHash = async (uri: string): Promise<HashName | undefined> => {
    const result = await urlIndex({ url: uri });
    if (result.length > 0) {
      return result[0].hash;
    }
  };
  const articleLdFetcher = createArticleLdFetcher(
    getHash,
    localStoreRead,
    localStoreWrite,
    indexLinkedData
  );

  return { articleLdFetcher, articleContentFetcher, directoryIndex };
};

export const App = asyncLoader(
  measureAsyncTime("init", initDb),
  ({ articleContentFetcher, articleLdFetcher, directoryIndex }) => (render) => {
    const [articleHashProvider, articleHash] = dataPortal<HashName>();
    render(
      div(
        div(
          { id: "navigation" },
          slot("profile", profilePanel()),
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
