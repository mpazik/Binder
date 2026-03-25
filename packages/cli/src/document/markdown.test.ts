import { describe, expect, it } from "bun:test";
import {
  parseMarkdown,
  renderAstToMarkdown,
  simplifyAst,
  simplifyViewAst,
  type SimplifiedViewInlineChild,
  parseAst,
  removePosition,
} from "./markdown.ts";
import { parseView } from "./view.ts";

describe("markdown", () => {
  describe("parseMarkdown", () => {
    it("parses heading", () => {
      const ast = parseMarkdown("# Hello");
      expect(ast).toMatchObject({
        type: "root",
        children: [
          {
            type: "heading",
            depth: 1,
            children: [{ type: "text", value: "Hello" }],
          },
        ],
      });
    });

    it("parses paragraph", () => {
      const ast = parseMarkdown("Hello world");
      expect(ast).toMatchObject({
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", value: "Hello world" }],
          },
        ],
      });
    });

    it("flattens inline formatting into text", () => {
      const ast = parseMarkdown("Hello **bold** and _italic_");
      expect(ast).toMatchObject({
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", value: "Hello **bold** and _italic_" }],
          },
        ],
      });
    });

    it("parses list with inline formatting flattened", () => {
      const ast = parseMarkdown("- **Item 1**\n- _Item 2_");
      expect(ast).toMatchObject({
        type: "root",
        children: [
          {
            type: "list",
            ordered: false,
            children: [
              {
                type: "listItem",
                children: [
                  {
                    type: "paragraph",
                    children: [{ type: "text", value: "**Item 1**" }],
                  },
                ],
              },
              {
                type: "listItem",
                children: [
                  {
                    type: "paragraph",
                    children: [{ type: "text", value: "_Item 2_" }],
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it("preserves multi-line text in paragraph", () => {
      const ast = parseMarkdown("Line one\nLine two");
      expect(ast).toMatchObject({
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", value: "Line one\nLine two" }],
          },
        ],
      });
    });

    it("trailing empty section produces only heading node", () => {
      const ast = parseMarkdown("## Summary\n\n");
      expect(ast.children).toEqual([
        expect.objectContaining({ type: "heading", depth: 2 }),
      ]);
    });

    it("preserves curly-brace patterns in link URLs", () => {
      const ast = parseMarkdown("[link](path/{field})\n");
      expect(ast.children[0]).toMatchObject({
        type: "paragraph",
        children: [{ type: "text", value: "[link](path/{field})" }],
      });
    });

    it("preserves nested curly-brace patterns in link URLs", () => {
      const ast = parseMarkdown(
        "## Context ([{parent.weekPeriod}](../weeks/{parent.weekPeriod}))\n",
      );
      expect(ast.children[0]).toMatchObject({
        type: "heading",
        children: [
          {
            type: "text",
            value:
              "Context ([{parent.weekPeriod}](../weeks/{parent.weekPeriod}))",
          },
        ],
      });
    });
  });

  describe("renderAstToMarkdown", () => {
    const check = (input: string, expected: string) => {
      expect(renderAstToMarkdown(parseAst(input))).toBe(expected);
    };

    it("renders heading", () => {
      check("# Hello", "# Hello\n");
    });

    it("renders list with dash bullet", () => {
      check("- Item 1\n- Item 2", "- Item 1\n- Item 2\n");
    });

    it("renders thematic break with dashes", () => {
      check("---", "---\n");
    });

    it("renders frontmatter yaml node", () => {
      check(
        "---\ntitle: Hello\n---\n\n# Hello\n",
        "---\ntitle: Hello\n---\n\n# Hello\n",
      );
    });

    it("renders emphasis with underscore", () => {
      check("*italic*", "_italic_\n");
    });

    it("renders paragraph followed by list without blank line", () => {
      check(
        "Focus areas:\n- Item 1\n- Item 2",
        "Focus areas:\n- Item 1\n- Item 2\n",
      );
    });
  });

  describe("parseAst", () => {
    it("preserves inline formatting structure", () => {
      const ast = removePosition(parseAst("**bold**"));
      expect(ast).toMatchObject({
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "strong",
                children: [{ type: "text", value: "bold" }],
              },
            ],
          },
        ],
      });
    });
  });

  describe("simplifyAst", () => {
    it("flattens inline formatting", () => {
      expect(simplifyAst(parseAst("**bold** and _italic_"))).toMatchObject({
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", value: "**bold** and _italic_" }],
          },
        ],
      });
    });
  });

  describe("simplifyViewAst", () => {
    const check = (input: string, expected: SimplifiedViewInlineChild[]) => {
      const simplified = simplifyViewAst(parseView(input));
      expect(simplified.children[0]!.children!).toEqual(expected);
    };

    it("flattens link with field slot in text only", () => {
      check("[{title}](../items)\n", [
        { type: "text", value: "[" },
        expect.objectContaining({ type: "fieldSlot", path: ["title"] }),
        { type: "text", value: "](../items)" },
      ]);
    });

    it("creates field slots for URL placeholders in links", () => {
      check("[{title}](../items/{key})\n", [
        { type: "text", value: "[" },
        expect.objectContaining({ type: "fieldSlot", path: ["title"] }),
        { type: "text", value: "](../items/" },
        expect.objectContaining({ type: "fieldSlot", path: ["key"] }),
        { type: "text", value: ")" },
      ]);
    });

    it("creates field slots for nested URL placeholders", () => {
      check("[← {project.title}](../projects/{project.key})\n", [
        { type: "text", value: "[← " },
        expect.objectContaining({
          type: "fieldSlot",
          path: ["project", "title"],
        }),
        { type: "text", value: "](../projects/" },
        expect.objectContaining({
          type: "fieldSlot",
          path: ["project", "key"],
        }),
        { type: "text", value: ")" },
      ]);
    });

    it("handles link with URL placeholder but no text slot", () => {
      check("[Back](../weeks/{weekPeriod})\n", [
        { type: "text", value: "[Back](../weeks/" },
        expect.objectContaining({ type: "fieldSlot", path: ["weekPeriod"] }),
        { type: "text", value: ")" },
      ]);
    });

    it("handles link with multiple URL placeholders", () => {
      check("[link](/{type}/{key})\n", [
        { type: "text", value: "[link](/" },
        expect.objectContaining({ type: "fieldSlot", path: ["type"] }),
        { type: "text", value: "/" },
        expect.objectContaining({ type: "fieldSlot", path: ["key"] }),
        { type: "text", value: ")" },
      ]);
    });

    it("leaves link without URL placeholders unchanged", () => {
      check("[{title}](https://example.com)\n", [
        { type: "text", value: "[" },
        expect.objectContaining({ type: "fieldSlot", path: ["title"] }),
        { type: "text", value: "](https://example.com)" },
      ]);
    });

    it("handles link with URL placeholder alongside bold text", () => {
      check("**Go to** [{title}](../items/{key})\n", [
        { type: "text", value: "**Go to** [" },
        expect.objectContaining({ type: "fieldSlot", path: ["title"] }),
        { type: "text", value: "](../items/" },
        expect.objectContaining({ type: "fieldSlot", path: ["key"] }),
        { type: "text", value: ")" },
      ]);
    });
  });

  describe("removePosition", () => {
    it("removes position from nested objects", () => {
      const input = {
        type: "root",
        position: { start: { line: 1 }, end: { line: 1 } },
        children: [{ type: "text", position: { start: { line: 1 } } }],
      } as const;
      const result = removePosition(input);
      expect(result).toMatchObject({
        type: "root",
        children: [{ type: "text" }],
      });
      expect("position" in result).toBe(false);
    });
  });
});
