import { Article } from "schema-dts";

import { throwIfNull } from "../libs/errors";
import { hashUriToHashName } from "../libs/hash";
import { findHashUri } from "../libs/linked-data";
import { measureAsyncTime } from "../libs/performance";

import { parseArticleContent } from "./article-processor";
import { StoreRead } from "./store";

export type ArticleContentFetcher = (article: Article) => Promise<Document>;

export const createArticleContentFetcher = (
  storeRead: StoreRead
): ArticleContentFetcher => async (article) => {
  const hashUri = throwIfNull(findHashUri(article));

  return await measureAsyncTime("read stored", async () => {
    const contentBlob: Blob = await throwIfNull(
      await storeRead(hashUriToHashName(hashUri))
    );
    return parseArticleContent(await contentBlob.text());
  });
};
