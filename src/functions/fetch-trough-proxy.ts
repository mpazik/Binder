export type Fetch = typeof fetch;

// const fetchTroughProxy: Fetch = (url: RequestInfo, init?: RequestInit) => {
//   return fetch(url, {
//     ...init,
//     headers: { ...init?.headers, proxy: "enabled" },
//   });
// };

const fetchTroughProxy: Fetch = (url: RequestInfo, init?: RequestInit) => {
  return fetch("/proxy/" + url, init);
};

export const createProxyFetch = (): Promise<Fetch> =>
  Promise.resolve(fetchTroughProxy);
// new Promise<Fetch>((resolve) => {
//   if (!("serviceWorker" in navigator)) {
//     throw new Error("Service worker is not supported by your browser");
//   }
//
//   navigator.serviceWorker.register("./worker.js");
//
//   const timeout = setTimeout(() => {
//     throw new Error("Timeout setting up serviceworker");
//   }, 5000);
//
//   navigator.serviceWorker.ready.then((registration) => {
//     clearTimeout(timeout);
//     if (!registration.active) {
//       throw new Error("Service worker could not be activated");
//     }
//
//     navigator.serviceWorker.addEventListener("message", (event) => {
//       const data = event.data;
//       if (Array.isArray(data) && data[0] === "pong") {
//         setTimeout(() => {
//           resolve(fetchTroughProxy);
//           console.log("service worker registration completed");
//         }, 10000);
//       }
//     });
//     registration.active.postMessage(["ping"]);
//   });
// });
