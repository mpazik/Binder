import type { HashUri } from "../hash";
import type { LinkedDataWithHashId } from "../jsonld-format";

export const linkedData1: LinkedDataWithHashId = {
  "@id": "nih:sha-256;e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as HashUri,
  prop: "value",
};

export const linkedData2: LinkedDataWithHashId = {
  "@id": "nih:sha-256;e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8556" as HashUri,
  something: "else",
  real: true,
};

export const linkedData3: LinkedDataWithHashId = {
  "@id": "nih:sha-256;e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8557" as HashUri,
  number: 4,
  real: false,
};
