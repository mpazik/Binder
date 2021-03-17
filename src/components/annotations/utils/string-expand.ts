export const minSelectorLength = 20;

const whiteChars = [9, 10, 11, 12, 13, 32, 160];

export const indexOfWordStart = (text: string, start: number): number => {
  for (let i = start - 1; i > 0; i--) {
    if (whiteChars.includes(text.charCodeAt(i))) {
      return i + 1;
    }
  }
  return 0;
};

export const indexOfWordEnd = (text: string, end: number): number => {
  for (let i = end + 1; i < text.length; i++) {
    if (whiteChars.includes(text.charCodeAt(i))) {
      return i;
    }
  }
  return text.length;
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
  if (
    (end - start >= minSelectorLength && isUnique(text, start, end)) ||
    (start === 0 && end === text.length)
  ) {
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
