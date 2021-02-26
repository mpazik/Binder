type PartSearchResult<T> = [parts: T[], start: number, end: number] | undefined;
type InPartsFiner<T> = (partObj: T, partText: string) => PartSearchResult<T>;

export const createInPartsFinder = <T>(exact: string): InPartsFiner<T> => {
  const exactLength = exact.length;
  let start = -1;
  let parts: T[] = [];
  let matched = 0;

  return (partObj, partText) => {
    const partLength = partText.length;

    let i = 0;
    if (matched == 0) {
      for (; i < partLength && matched < exactLength; i++) {
        matched = partText[i] === exact[matched] ? matched + 1 : 0;
      }
      if (matched === 0) return;
      start = i - matched;
      parts = [partObj];
    } else {
      if (matched === exactLength) {
        throw new Error(
          `Can not continue to search of '${exact}' which was already found`
        );
      }
      for (; i < partLength && matched < exactLength; i++) {
        if (partText[i] === exact[matched]) {
          matched = matched + 1;
        } else {
          matched = 0;
          return;
        }
      }
      parts.push(partObj);
    }

    if (matched === exactLength) {
      return [parts, start, i];
    }
  };
};

export const findInParts = (
  parts: string[],
  string: string
): PartSearchResult<string> => {
  const inPartsFinder = createInPartsFinder<string>(string);
  return parts.reduce<PartSearchResult<string>>(
    (result, a) => (result ? result : inPartsFinder(a, a)),
    undefined
  );
};

type Searcher<T> = (
  part: string,
  obj: T,
  length: number,
  i: number
) => PartSearchResult<T>;

export const createInPartsFinder2 = <T>(
  exact: string,
  prefix?: string,
  suffix?: string
): InPartsFiner<T> => {
  const exactLength = exact.length;
  const prefixLength = prefix?.length || 0;
  const suffixLength = suffix?.length || 0;
  const startSearching = prefix ? prefix : exact;
  const startSearchingLength = startSearching.length;

  let start = -1;
  let end = -1;
  let parts: T[] = [];
  let matched = 0;
  let searching: string = startSearching;
  let searchingLength = startSearchingLength;

  return (obj, part) => {
    const length = part.length;
    let i = 0;
    while (matched !== searchingLength) {
      for (; i < length && matched < searchingLength; i++) {
        if (part[i] === searching[matched]) {
          matched++;
        } else {
          matched = 0;
          // variant for start and non start?
          searching = startSearching;
          searchingLength = startSearchingLength;
          start = -1;
          break; // while
        }
      }
      if (searchingLength === 0) {
        return [parts, start, end];
      }
      if (searching === exact) {
        if (start === -1) {
          start = i - matched;
          parts = [obj];
        } else {
          parts.push(obj);
        }
      }
      if (matched !== searchingLength) {
        return; // finish the loop
      }
      matched = 0;
      if (searching === prefix) {
        searching = exact;
        searchingLength = exact.length;
      } else if (searching === exact) {
        end = i;
        if (suffix) {
          searching = suffix;
          searchingLength = suffix.length;
        } else {
          searchingLength = 0;
        }
      } else if (searching === suffix) {
        searchingLength = 0;
      }
    }
  };
};

export const findInParts2 = (
  parts: string[],
  string: string,
  prefix?: string,
  suffix?: string
): PartSearchResult<string> => {
  const inPartsFinder = createInPartsFinder2<string>(string, prefix, suffix);
  return parts.reduce<PartSearchResult<string>>(
    (result, a) => (result ? result : inPartsFinder(a, a)),
    undefined
  );
};
