import { asyncPool } from "../../libs/async-pool";
import { GDriveConfig, getContent } from "../gdrive/app-files";
import { listFiles } from "../gdrive/file";
import { UpdateIndex } from "../indexes/types";

import { LinkedDataStoreIterate, LinkedDataStoreWrite } from "./local-store";

export const newMissingLinkedDataDownloader = (
  storeIterate: LinkedDataStoreIterate,
  storeWrite: LinkedDataStoreWrite,
  index: UpdateIndex,
  config: GDriveConfig
) => async (since?: Date): Promise<Date> => {
  const till = new Date();
  const fileModifiedSinceLastCheck = await listFiles(
    config.dirs.linkedData,
    config.token,
    since
  );

  const filesToDownload = fileModifiedSinceLastCheck.slice();
  await storeIterate((hashUri) => {
    removeItemByPredicate(filesToDownload, (it) => it.hashUri === hashUri);
  });

  await asyncPool(3, filesToDownload, async (file) => {
    const content = await getContent(config, file.hashUri);
    if (content) {
      const linkedDataWithHash = await storeWrite(
        JSON.parse(await content.text())
      );
      await index(linkedDataWithHash);
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
