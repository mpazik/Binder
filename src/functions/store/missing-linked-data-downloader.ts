import { asyncPool } from "../../libs/async-pool";
import { hashNameToHashUri, hashUriToHashName } from "../../libs/hash";
import { GDriveConfig, getContent } from "../gdrive/app-files";
import { listFiles } from "../gdrive/file";
import { Indexer } from "../indexes/types";

import { StoreIterate, StoreWrite } from "./local-store";

export const newMissingLinkedDataDownloader = (
  localStoreIterate: StoreIterate,
  localStoreWrite: StoreWrite,
  index: Indexer,
  config: GDriveConfig
) => async (since?: Date): Promise<Date> => {
  const till = new Date();
  const fileModifiedSinceLastCheck = await listFiles(
    config.dirs.linkedData,
    config.token,
    since
  );

  const filesToDownload = fileModifiedSinceLastCheck.slice();
  await localStoreIterate((hash) => {
    removeItemByPredicate(
      filesToDownload,
      (it) => it.hashUri === hashNameToHashUri(hash)
    );
  });

  await asyncPool(3, filesToDownload, async (file) => {
    const content = await getContent(config, file.hashUri);
    if (content) {
      await localStoreWrite(content);
      await index({
        ld: JSON.parse(await content.text()),
        hash: hashUriToHashName(file.hashUri),
      });
    } else {
      console.error(
        `No file ${file.hashUri} on gdrive but it was  returned during listing`
      );
    }
  });
  return till;
};

const removeItemByPredicate = <T>(
  array: T[],
  predicate: (item: T) => boolean
): T[] => {
  const index = array.findIndex(predicate);
  if (index) array.splice(index, 1);
  return array;
};
