import { Opaque } from "./types";

type Hash = ArrayBuffer;
type HashingAlgorithm = "sha-1" | "sha-256" | "sha-384" | "sha-512";
type HashReference = [Hash, HashingAlgorithm];

const hashUriScheme = "nih"; // named information hex format https://tools.ietf.org/html/rfc6920

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

const bufferToHex = (arrayBuffer: ArrayBuffer) => {
  const buff = new Uint8Array(arrayBuffer);
  const hexOctets = [];
  for (let i = 0; i < buff.length; ++i) hexOctets.push(byteToHex[buff[i]]);
  return hexOctets.join("");
};

const referenceToHashName = async (ref: HashReference): Promise<HashUri> =>
  `${ref[1]}_${bufferToHex(ref[0])}` as HashUri;

export const hashBlob = async (
  data: Blob,
  algorithm: HashingAlgorithm = "sha-256"
): Promise<HashName> => {
  const buffer = await data.arrayBuffer();
  const hash: Hash = await crypto.subtle.digest(algorithm, buffer);
  return referenceToHashName([hash, algorithm]);
};
