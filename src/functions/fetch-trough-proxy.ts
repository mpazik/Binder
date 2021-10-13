import { isLocalUrl } from "../components/common/link";
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
  const url = typeof request === "string" ? request : request.url;
  return (isLocalUrl(url) ? fetch : fetchTroughProxy)(request, init);
};

export const createProxyFetch = (): Promise<Fetch> =>
  Promise.resolve(createConditionalFetchTroughProxy);
