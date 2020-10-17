import { useEffect, useState } from "react";

export const useQueryParams = (): URLSearchParams => {
  const [queryParams, setQueryParams] = useState<URLSearchParams>(
    new URLSearchParams(window.location.search)
  );

  const update = () => {
    setQueryParams(new URLSearchParams(window.location.search));
  };

  const hijackLink = (event: Event) => {
    const target = event.target as HTMLElement;
    if (!target || target.nodeName !== "A") return;
    const uri = target.getAttribute("href");
    if (!uri || (uri && uri.startsWith("#"))) {
      return;
    }
    const queryParams = new URLSearchParams(window.location.search);
    queryParams.set("uri", uri);
    window.history.pushState({}, "", "?" + queryParams.toString());
    setQueryParams(queryParams);
    event.preventDefault();
  };

  useEffect(() => {
    window.addEventListener("popstate", update);
    document.addEventListener("click", hijackLink);

    return () => {
      document.removeEventListener("popstate", update);
      document.removeEventListener("click", hijackLink);
    };
  });

  return queryParams;
};
