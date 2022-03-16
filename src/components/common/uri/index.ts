type LinkTarget = "_blank" | "_self";

const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z0-9+-.]*?:[^\s]*$/;

export type Uri = string;

// Scheme: https://tools.ietf.org/html/rfc3986#section-3.1
// Absolute URI: https://tools.ietf.org/html/rfc3986#section-4.3
export const isAbsoluteUri = (uri: Uri): boolean =>
  ABSOLUTE_URL_REGEX.test(uri);

export function getLinkTarget(uri: Uri): LinkTarget {
  return isAbsoluteUri(uri) ? "_blank" : "_self";
}

export const isLocalUri = (uri: Uri): boolean =>
  uri.startsWith(window.location.origin);
