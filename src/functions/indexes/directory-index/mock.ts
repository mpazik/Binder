import { HashUri } from "../../../libs/hash";

import { createQueryMatcher } from "./utils";

import { DirectoryIndex, DirectoryRecord } from "./index";

export const hydraDocHash = "nih:sha-256;02180c4f7f7deb56c7c77ddbb9a2e7da84461f43deb5ecb192e955df175eb1c0" as HashUri;
export const hydraDirRecord = {
  hash: hydraDocHash,
  props: {
    name: "How to Fight a Hydra",
    type: "Book",
  },
};

export const discOrgDocHash = "nih:sha-256;03e479cd7e0e2c8aab66b88ad05e4cd2718caaf7d51169e93eef3670b4a43cc9" as HashUri;
export const discOrgDirRecord = {
  hash: discOrgDocHash,
  props: {
    name: "The Discipline of Organizing",
    type: "Book",
  },
};

export const artOfChartDocHash = "nih:sha-256;7b042d5d0e5007c6634318f3beaa842186f2ef3245439b36e192b4b3b9a13786" as HashUri;
export const artOfChartDirRecord = {
  hash: artOfChartDocHash,
  props: {
    name: "The_Art_of_the_Chart.pdf",
    type: "Book",
  },
};

export const definitionDocHash = "nih:sha-256;8d597a1e03655db09311ae431a090f8eca7e76b9523707bbbe7c24e1e0be25d9" as HashUri;
export const definitionDirRecord = {
  hash: definitionDocHash,
  props: {
    name: "Definition",
    type: "Article",
  },
};

export const firetDocHash = "nih:sha-256;8f8a46fb60deb2d1daf54ceffc6a502328ad6dca1a3bcb234dab0963df1b4806" as HashUri;
export const firetDirRecord = {
  hash: firetDocHash,
  props: {
    name: "Firet",
    type: "Article",
  },
};

export const directoryRecords: DirectoryRecord[] = [
  hydraDirRecord,
  discOrgDirRecord,
  artOfChartDirRecord,
  definitionDirRecord,
  firetDirRecord,
];

export const createInMemorySearchDirectoryIndex = (
  records: DirectoryRecord[]
): DirectoryIndex["search"] => async (query) =>
  records.filter(createQueryMatcher(query));
