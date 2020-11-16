import React, { useCallback, useState } from "react";

import "./styles.css";
import "./loading.css";

import { Article } from "schema-dts";

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
import { HashName } from "../../utils/hash";
import { LinkedDataWithItsHash } from "../../utils/linked-data";
import { measureAsyncTime } from "../../utils/performance";
import { ArticleComponent } from "../article-component";
import { AsyncLoader } from "../common/async-loader";
import { Navigation } from "../navigation";
import { Profile } from "../profile";

const Nav: React.FC<{ hash?: HashName; directoryIndex: DirectoryIndex }> = ({
  hash,
  directoryIndex,
}) => {
  const promise = useCallback(() => directoryIndex({}), [directoryIndex, hash]);

  return (
    <div id="navigation">
      <Profile />
      <AsyncLoader promise={promise}>
        {(items) => <Navigation list={items} current={hash} />}
      </AsyncLoader>
    </div>
  );
};
const AppWithLinkedData: React.FC<{
  articleLdFetcher: ArticleLdFetcher;
  articleContentFetcher: ArticleContentFetcher;
  directoryIndex: DirectoryIndex;
}> = ({ articleContentFetcher, articleLdFetcher, directoryIndex }) => {
  const [currentArticle, setCurrentArticle] = useState<
    LinkedDataWithItsHash<Article>
  >();

  return (
    <div>
      <Nav hash={currentArticle?.hash} directoryIndex={directoryIndex} />
      <div id="container">
        <div className="p-4">
          <ArticleComponent
            articleLdFetcher={articleLdFetcher}
            contentFetcher={articleContentFetcher}
            onArticleLoaded={setCurrentArticle}
          />
        </div>
      </div>
    </div>
  );
};

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

export const App: React.FC = () => {
  return (
    <AsyncLoader
      promise={useCallback(() => measureAsyncTime("init", initDb), [])}
    >
      {(services) => <AppWithLinkedData {...services} />}
    </AsyncLoader>
  );
};
