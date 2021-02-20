// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path='../node_modules/typescript/lib/lib.webworker.d.ts' />

import { PROXY_SERVER } from "./config";

export {};
declare let self: ServiceWorkerGlobalScope;

self.addEventListener("activate", () => {
  console.log("Service worker: activated");
});

self.addEventListener("fetch", (event: FetchEvent) => {
  console.log("Service worker: got fetch");
  event.respondWith(
    (() => {
      const request: Request = event.request;
      if (request.headers.get("proxy")) {
        return fetch(PROXY_SERVER + request.url, {
          signal: request.signal,
        }).then((r) => new Response(r.body));
      }
      return fetch(request);
    })()
  );
});

self.addEventListener("message", async (event) => {
  const data = event.data;
  if (Array.isArray(data) && data[0] === "ping") {
    if (!event.source) {
      throw new Error("Service worker: can not send back message to the page");
    }
    event.source.postMessage(["pong"], []);
  }
});
