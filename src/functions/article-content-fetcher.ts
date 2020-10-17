import { Article } from "schema-dts";

import { throwIfNull } from "../utils/errors";
import { hashUriToHashName } from "../utils/hash";
import { findHashUri } from "../utils/linked-data";
import { measureAsyncTime } from "../utils/performance";

import { parseArticleContent } from "./article-processor";
import { StoreRead } from "./local-store";

export type ArticleContentFetcher = (
  article: Article,
  signal?: AbortSignal
) => Promise<Document>;

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
