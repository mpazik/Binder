// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path='../node_modules/typescript/lib/lib.webworker.d.ts' />

import { PROXY_SERVER } from "./config";

export {};
declare let self: ServiceWorkerGlobalScope;

self.addEventListener("fetch", (event: FetchEvent) => {
  event.respondWith(
    (() => {
      const request: Request = event.request;
      if (request.headers.get("proxy")) {
        return fetch(PROXY_SERVER + request.url, { signal: request.signal }).then(
          (r) => new Response(r.body)
        );
      }
      return fetch(request);
    })()
  );
});
