/**
 * Delimiter-separated values (CSV/TSV) serialization.
 *
 * CSV uses RFC 4180 quoting; TSV replaces tabs/newlines with spaces.
 */

export const formatDsvCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (value.every((v) => typeof v !== "object" || v === null))
      return value
        .map((v) => (v === null || v === undefined ? "" : String(v)))
        .join(", ");
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
};

export const escapeCsvCell = (cell: string): string => {
  if (
    cell.includes(",") ||
    cell.includes('"') ||
    cell.includes("\n") ||
    cell.includes("\r")
  )
    return `"${cell.replace(/"/g, '""')}"`;
  return cell;
};

export const escapeTsvCell = (cell: string): string =>
  cell.replace(/[\t\n\r]/g, " ");

export const serializeDsv = (
  items: unknown[],
  delimiter: "," | "\t",
): string => {
  const records = items as Record<string, unknown>[];
  const headerSet = new Set<string>();
  for (const item of records) {
    if (item && typeof item === "object") {
      for (const key of Object.keys(item)) headerSet.add(key);
    }
  }
  const headers = Array.from(headerSet);
  const escape = delimiter === "," ? escapeCsvCell : escapeTsvCell;

  const lines: string[] = [];
  lines.push(headers.map(escape).join(delimiter));
  for (const item of records) {
    const row = headers.map((h) => {
      const raw = formatDsvCell(item?.[h]);
      return escape(raw);
    });
    lines.push(row.join(delimiter));
  }
  return lines.join("\n");
};
