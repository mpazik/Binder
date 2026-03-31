import { describe, expect, it } from "bun:test";
import { formatHelpOutput } from "./help.ts";

describe("formatHelpOutput", () => {
  it("strips type tags", () => {
    const input = "  --help  show help  [boolean]";
    expect(formatHelpOutput(input)).toBe("  --help  show help");
  });

  it("strips [default: false]", () => {
    const input = "  -q, --quiet  suppress output  [boolean] [default: false]";
    expect(formatHelpOutput(input)).toBe("  -q, --quiet  suppress output");
  });

  it("keeps meaningful defaults and choices", () => {
    const input =
      '  --format  output format  [string] [choices: "json", "yaml"] [default: "json"]';
    const output = formatHelpOutput(input);
    expect(output).not.toContain("[string]");
    expect(output).toContain('[choices: "json", "yaml"]');
    expect(output).toContain('[default: "json"]');
  });

  it("preserves lines without metadata", () => {
    const input = "  -f, --fields  relatesTo[type=Task](title)";
    expect(formatHelpOutput(input)).toBe(input);
  });
});
