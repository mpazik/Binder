import { parseDocument } from "yaml";

import type { ParsedMarkdown } from "../../document/markdown.ts";
import { createValidationError, type Validator } from "../types.ts";

const toZeroBased = (pos: number | undefined, offset: number): number =>
  (pos ?? 1) - 1 + offset;

export const createMarkdownValidator = (): Validator<ParsedMarkdown> => ({
  validate: (content) => {
    const yamlNode = content.root.children.find(
      (child) => child.type === "yaml",
    );
    if (
      !yamlNode ||
      !("value" in yamlNode) ||
      typeof yamlNode.value !== "string"
    )
      return [];

    // remark positions are 1-based; +1 for opening `---`, -1 for 0-based = net 0
    const lineOffset = yamlNode.position?.start.line ?? 1;

    const doc = parseDocument(yamlNode.value);
    const seen = new Set<string>();

    return doc.errors.flatMap((docError) => {
      const startLine = toZeroBased(docError.linePos?.[0]?.line, lineOffset);
      const startCol = toZeroBased(docError.linePos?.[0]?.col, 0);
      const dedupeKey = `${startLine}:${startCol}:${docError.code}`;
      if (seen.has(dedupeKey)) return [];
      seen.add(dedupeKey);

      return createValidationError("yaml-syntax-error", docError.message, {
        start: { line: startLine, character: startCol },
        end: {
          line: toZeroBased(docError.linePos?.[1]?.line, lineOffset),
          character: toZeroBased(docError.linePos?.[1]?.col, 0),
        },
      });
    });
  },
});
