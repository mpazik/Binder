import { Article } from "schema-dts";

import { HashName } from "../utils/hash";
import { fileExtension, LinkedDataWithItsHash } from "../utils/linked-data";

export const fetchLinkedDataList = (): Promise<HashName[]> =>
  fetch("./linked-data/list.json").then((it) => it.json());

export const fetchArticledLd = (name: HashName): Promise<Article> =>
  fetch(`./linked-data/${name}.${fileExtension}`).then((it) => it.json());

export const fetchLinkedDataAssets = async (): Promise<
  LinkedDataWithItsHash<Article>[]
> => {
  const list = await fetchLinkedDataList();
  return await Promise.all(
    list.map(async (it) => ({
      ld: await fetchArticledLd(it),
      hash: it,
    }))
  );
};
