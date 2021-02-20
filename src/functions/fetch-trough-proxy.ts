import { PROXY_SERVER } from "../config";

export type Fetch = typeof fetch;

const fetchTroughProxy: Fetch = (url: RequestInfo, init?: RequestInit) => {
  return fetch(`${PROXY_SERVER}${url}`, init);
};

export const createProxyFetch = (): Promise<Fetch> =>
  Promise.resolve(fetchTroughProxy);
