import { Opaque } from "./types";

export type HashUri = Opaque<string>;
export type HashName = Opaque<string>;

const hashUriScheme = "nih"; // named information hex format https://tools.ietf.org/html/rfc6920

export const isHashUri = (uri: string): uri is HashUri =>
  uri.startsWith(hashUriScheme);

export const hashUriToHashName = (hash: HashUri): HashName =>
  hash.slice(4).replace(";", "_") as HashName;

export const hashNameToHashUri = (name: HashName): HashUri =>
  `${hashUriScheme}:${name.replace("_", ";")}` as HashUri;
