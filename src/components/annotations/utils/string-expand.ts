export const minSelectorLength = 20;

const whiteChars = [9, 10, 11, 12, 13, 32, 160];
const wordSearchLimit = 10; // there are cases when there is no white character used in text or higher Unicode are used

export const indexOfWordStart = (text: string, start: number): number => {
  const limit = Math.max(0, start - wordSearchLimit);
  for (let i = start - 1; i > limit; i--) {
    if (whiteChars.includes(text.charCodeAt(i))) {
      return i + 1;
    }
  }
  return limit;
};

export const indexOfWordEnd = (text: string, end: number): number => {
  const limit = Math.min(text.length, end + wordSearchLimit);
  for (let i = end + 1; i < limit; i++) {
    if (whiteChars.includes(text.charCodeAt(i))) {
      return i;
    }
  }
  return limit;
};

const isUnique = (text: string, start: number, end: number): boolean => {
  const part = text.substring(start, end);
  const startCheck = text.indexOf(part, 0);
  if (start != startCheck) return false;
  const nextMath = text.indexOf(part, end);
  return nextMath === -1;
};

const expandTextRange = (
  text: string,
  start: number,
  end: number,
  expandSuffix = true
): [start: number, end: number] => {
  const min = end - start >= minSelectorLength;
  const unique = isUnique(text, start, end);
  const finished = start === 0 && end === text.length;
  if ((min && unique) || finished) {
    return [start, end];
  }

  return expandTextRange(
    text,
    expandSuffix ? start : indexOfWordStart(text, start - 1),
    expandSuffix ? indexOfWordEnd(text, end) : end,
    start === 0 ? true : end === text.length ? false : !expandSuffix
  );
};

export const expandText = (
  text: string,
  start: number,
  end: number
): [prefix: string, suffix: string] => {
  const [newStart, newEnd] = expandTextRange(text, start, end);
  return [text.substring(newStart, start), text.substring(end, newEnd)];
};
