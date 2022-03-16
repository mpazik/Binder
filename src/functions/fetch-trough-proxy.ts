import { isLocalUri } from "../components/common/uri";
import { PROXY_SERVER } from "../config";

export type Fetch = typeof fetch;

const fetchTroughProxy: Fetch = (request: RequestInfo, init?: RequestInit) => {
  if (typeof request === "string") {
    return fetch(`${PROXY_SERVER}${request}`, init);
  }
  const newRequest = new Request({
    ...request,
    url: `${PROXY_SERVER}${request.url}`,
  });
  return fetch(newRequest, init);
};

const createConditionalFetchTroughProxy: Fetch = (
  request: RequestInfo,
  init?: RequestInit
) => {
  const uri = typeof request === "string" ? request : request.url;
  return (isLocalUri(uri) ? fetch : fetchTroughProxy)(request, init);
};

export const createProxyFetch = (): Promise<Fetch> =>
  Promise.resolve(createConditionalFetchTroughProxy);
