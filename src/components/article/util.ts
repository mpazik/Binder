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

  let start = -1;
  let end = -1;
  let parts: T[] = [];
  let matched = 0;

  let matching: "prefix" | "exact" | "suffix" | "exactStart" | "found" = prefix
    ? "prefix"
    : "exactStart";

  const findSuffix: Searcher<T> = (part, obj, length, i) => {
    for (; i < length && matched < suffixLength; i++) {
      if (part[i] === suffix![matched]) {
        matched++;
      } else {
        return startSetup(part, obj, length, i);
      }
    }
    if (matched === exactLength) {
      matching = "found";
      return [parts, start, end];
    }
  };

  const findSuffixSetup: Searcher<T> = (part, obj, length, i) => {
    if (!suffix) {
      return [parts, start, end];
    }
    matched = 0;
    matching = "suffix";
    return findSuffix(part, obj, length, i);
  };

  const findExact: Searcher<T> = (part, obj, length, i) => {
    for (; i < length && matched < exactLength; i++) {
      if (part[i] === exact[matched]) {
        matched++;
      } else {
        return startSetup(part, obj, length, i);
      }
    }
    start = i - matched;
    parts = [obj];
    if (matched === exactLength) {
      end = i;
      return findSuffixSetup(part, obj, length, i);
    }
  };

  const findExactStart: Searcher<T> = (part, obj, length, i) => {
    for (; i < length && matched < prefixLength; i++) {
      matched = part[i] === prefix![matched] ? matched + 1 : 0;
    }
    start = i - matched;
    parts = [obj];
    if (matched === exactLength) {
      end = i;
      return findSuffixSetup(part, obj, length, i);
    }
  };

  const findPrefix: Searcher<T> = (part, obj, length, i) => {
    for (; i < length && matched < prefixLength; i++) {
      matched = part[i] === prefix![matched] ? matched + 1 : 0;
    }
    if (matched !== exactLength) return;
    matching = "exact";
    matched = 0;
    return findExact(part, obj, length, i);
  };

  const startSetup: Searcher<T> = (part, obj, length, i) => {
    matched = 0;
    matching = prefix ? "prefix" : "exactStart";
    if (prefix) {
      return findPrefix(part, obj, length, i);
    } else {
      return findExactStart(part, obj, length, i);
    }
  };

  return (obj, part) => {
    if (matching === "prefix") {
      findPrefix(part, obj, part.length, 0);
    } else if (matching === "exactStart") {
      findExactStart(part, obj, part.length, 0);
    } else if (matching === "exact") {
      findExact(part, obj, part.length, 0);
    } else if (matching === "suffix") {
      findSuffix(part, obj, part.length, 0);
    }
    return undefined;
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
