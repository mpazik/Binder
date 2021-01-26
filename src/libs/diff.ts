import { diffArrays } from "diff";

export interface ItemChange {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
}
type DocDiff = ItemChange[];

export const diffArrayItems = <TLeft, TRight = TLeft>(
  oldArray: TLeft[],
  newArray: TRight[],
  comparator?: (left: TLeft, right: TRight) => boolean
): DocDiff => {
  const diff = diffArrays(oldArray, newArray, { comparator });
  diff.push({ value: [] });

  const hunks: ItemChange[] = [];
  let oldRangeStart = 0,
    newRangeStart = 0,
    oldLine = 0,
    newLine = 0,
    previouslyModified = false;

  for (const current of diff) {
    const changeLength = current.value.length;

    if (current.added || current.removed) {
      // If we have previous context, start with that
      if (!previouslyModified) {
        previouslyModified = true;
        oldRangeStart = oldLine;
        newRangeStart = newLine;
      } // Output our changes

      if (current.added) {
        newLine += changeLength;
      } else {
        oldLine += changeLength;
      }
      continue;
    }
    if (previouslyModified) {
      hunks.push({
        oldStart: oldRangeStart,
        oldLines: oldLine - oldRangeStart,
        newStart: newRangeStart,
        newLines: newLine - newRangeStart,
      });
      previouslyModified = false;
    }

    oldLine += changeLength;
    newLine += changeLength;
  }
  return hunks;
};
