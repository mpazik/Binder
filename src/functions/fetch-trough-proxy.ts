export const fetchTroughProxy = (
  url: string,
  init?: RequestInit
): Promise<Response> =>
  fetch(url, { ...init, headers: { ...init?.headers, proxy: "enabled" } });
