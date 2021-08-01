export const recentDateComparator = (
  date1: Date | undefined,
  date2: Date | undefined
): number => {
  if (date1 === undefined) {
    if (date2 === undefined) return 0;
    return 1;
  }
  if (date2 === undefined) return -1;
  if (date1.getTime() === date2.getTime()) return 0;

  return date1 > date2 ? -1 : 1;
};
