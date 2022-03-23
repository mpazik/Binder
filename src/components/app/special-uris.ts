export const hostPageUri = (path: string): string =>
  `${window.location.origin}/${path}`;

export const isHostPageUri = (uri: string): boolean =>
  uri.startsWith(window.location.origin);

export const specialDirectoryPath = "directory";
export const specialDirectoryUri = hostPageUri(specialDirectoryPath);
export const specialTodayUri = hostPageUri("today");
