import { HashName } from "../utils/hash";
import {
  fileExtension,
  LinkedData,
  LinkedDataWithHash,
} from "../utils/linked-data";

export const fetchLinkedDataList = (): Promise<HashName[]> =>
  fetch("./linked-data/list.json").then((it) => it.json());

export const fetchLinkedData = (name: HashName): Promise<LinkedData> =>
  fetch(`./linked-data/${name}.${fileExtension}`).then((it) => it.json());

export const fetchLinkedDataAssets = async (): Promise<
  LinkedDataWithHash[]
> => {
  const list = await fetchLinkedDataList();
  return await Promise.all(
    list.map(async (it) => ({
      ld: await fetchLinkedData(it),
      hash: it,
    }))
  );
};
