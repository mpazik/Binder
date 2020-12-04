import { HashName } from "../libs/hash";
import { getDefaultStore } from "../libs/indexeddb";
import { jsonLdMimeType, LinkedDataWithItsHash } from "../libs/linked-data";

import { LocalStoreDb } from "./local-store";

/**
 * Continues invoking step until step returns true
 */
const asyncLoop = async (
  step: () => Promise<boolean | undefined>
): Promise<void> => {
  let continueLoop = true;
  while (continueLoop) {
    continueLoop = !(await step());
  }
  return;
};

const getNextDbRecord = (db: LocalStoreDb, previous?: HashName) =>
  new Promise<
    | {
        hash: HashName;
        blob: Blob;
      }
    | undefined
  >((resolve, reject) => {
    const idbRequest = getDefaultStore(db).openCursor(
      previous ? IDBKeyRange.lowerBound(previous, true) : undefined
    );
    idbRequest.onerror = reject;
    idbRequest.onsuccess = async (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
        .result;

      if (cursor) {
        const blob = cursor.value as Blob;
        if (blob.type === jsonLdMimeType) {
          resolve({
            hash: cursor.key as HashName,
            blob: blob,
          });
        } else {
          cursor.continue();
        }
      } else {
        resolve(undefined);
      }
    };
  });

export const createLinkedDataProvider = (
  localStoreDb: LocalStoreDb
): ((push: (ld: LinkedDataWithItsHash) => Promise<void>) => Promise<void>) => {
  let lastHash: HashName | undefined;
  return async (push) =>
    await asyncLoop(async () => {
      const result = await getNextDbRecord(localStoreDb, lastHash);
      if (!result) {
        return true;
      }

      const { hash, blob } = result;
      lastHash = hash;
      await push({
        hash,
        ld: JSON.parse(await blob.text()),
      });
    });
};
