import type { LinkedData, LinkedDataWithHashId } from "./jsonld-format";
import { normalizeLinkedData } from "./linked-data";
import type { Opaque } from "./types";

type Hash = ArrayBuffer;
type HashHex = string;
type HashingAlgorithm = "sha-1" | "sha-256" | "sha-384" | "sha-512";
type HashReference = [Hash, HashingAlgorithm];

export const hashUriScheme = "nih"; // named information hex format https://tools.ietf.org/html/rfc6920

export type HashUri = Opaque<string>;
export type HashName = Opaque<string>;

export const isHashUri = (uri: string): uri is HashUri =>
  uri.startsWith(hashUriScheme);

export const isHashName = (uri: string): uri is HashName =>
  uri.startsWith("sha-256_");

export const hashUriToHashName = (hash: HashUri): HashName =>
  hash.slice(4).replace(";", "_") as HashName;

export const hashNameToHashUri = (name: HashName): HashUri =>
  `${hashUriScheme}:${name.replace("_", ";")}` as HashUri;

const byteToHex: string[] = [...Array(0xff).keys()].map((n) =>
  n.toString(16).padStart(2, "0")
);

const hashToHex = (hash: Hash): HashHex => {
  const buff = new Uint8Array(hash);
  const hexOctets = [];
  for (let i = 0; i < buff.length; ++i) hexOctets.push(byteToHex[buff[i]]);
  return hexOctets.join("");
};

export const referenceToHashUri = ([hash, alg]: HashReference): HashUri =>
  `${hashUriScheme}:${alg};${hashToHex(hash)}` as HashUri;

export const referenceToHashName = ([hash, alg]: HashReference): HashUri =>
  `${alg}-${hashToHex(hash)}` as HashUri;

export type HashFunction<T> = (
  buffer: T,
  algorithm: HashingAlgorithm
) => Promise<Hash>;

export const hashBytes: HashFunction<ArrayBuffer> = (
  buffer,
  algorithm = "sha-256"
): Promise<Hash> => crypto.subtle.digest(algorithm, buffer);

export const hashString: HashFunction<string> = (
  string,
  algorithm = "sha-256"
): Promise<Hash> => hashBytes(new TextEncoder().encode(string), algorithm);

export const hashToUri = async <T>(
  data: T,
  fn: HashFunction<T>,
  algorithm: HashingAlgorithm = "sha-256"
): Promise<HashUri> =>
  referenceToHashUri([await fn(data, algorithm), algorithm]);

export const hashToName = async <T>(
  data: T,
  fn: HashFunction<T>,
  algorithm: HashingAlgorithm = "sha-256"
): Promise<HashName> =>
  referenceToHashName([await fn(data, algorithm), algorithm]);

export const hashBlob = async (
  data: Blob,
  algorithm: HashingAlgorithm = "sha-256"
): Promise<HashUri> => {
  const buffer = await data.arrayBuffer();
  return hashToUri(buffer, hashBytes, algorithm);
};

export const hashLinkedData = async (
  data: LinkedData,
  algorithm: HashingAlgorithm = "sha-256"
): Promise<HashUri> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { "@id": id, ...rest } = data;
  const normalized = await normalizeLinkedData(rest);
  return hashToUri(normalized, hashBytes, algorithm);
};

export const computeLinkedDataWithHashId = async (
  data: LinkedData,
  algorithm: HashingAlgorithm = "sha-256"
): Promise<LinkedDataWithHashId> => {
  // copy linked data to not modify passed property
  const { ...linkedDataToHash } = data;
  const oldId = linkedDataToHash["@id"];
  if (oldId && !oldId.startsWith(hashUriScheme)) {
    throw new Error(
      "Linked data already have hash uri Id, saving operation would remove it"
    );
  }
  delete linkedDataToHash["@id"]; // remove id as we would replace it
  const hashUri = await hashLinkedData(linkedDataToHash, algorithm);
  if (oldId && oldId !== hashUri) {
    throw new Error(`Filed ${oldId} is corrupted`);
  }
  linkedDataToHash["@id"] = hashUri;
  return linkedDataToHash as LinkedDataWithHashId;
};
