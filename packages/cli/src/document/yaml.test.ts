import { describe, expect, it } from "bun:test";
import { mockRecordSchema } from "@binder/db/mocks";
import {
  renderYamlEntity,
  renderYamlList,
  parseYamlEntity,
  parseYamlList,
  findEntityInYamlList,
} from "./yaml.ts";

describe("yaml", () => {
  describe("inline formatting", () => {
    it("renders short comma-delimited arrays inline", () => {
      const yaml = renderYamlEntity(
        { title: "Task", tags: ["bug", "urgent"] },
        mockRecordSchema,
      );
      expect(yaml).toContain("tags: [ bug, urgent ]");
    });

    it("renders single-element array inline", () => {
      const yaml = renderYamlEntity({ tags: ["only"] }, mockRecordSchema);
      expect(yaml).toContain("tags: [ only ]");
    });
  });

  describe("block formatting for relations and non-comma fields", () => {
    it("renders multi-value relation as block list", () => {
      const yaml = renderYamlEntity(
        { title: "Task", relatedTo: ["task-a", "task-b"] },
        mockRecordSchema,
      );
      expect(yaml).not.toContain("[");
      expect(yaml).toContain("relatedTo:\n  - task-a\n  - task-b");
    });

    it("renders single-element relation as block list", () => {
      const yaml = renderYamlEntity({ relatedTo: ["a"] }, mockRecordSchema);
      expect(yaml).not.toContain("[");
      expect(yaml).toContain("relatedTo:\n  - a");
    });

    it("renders relation fields as block list in list items", () => {
      const yaml = renderYamlList(
        [
          { title: "Task 1", relatedTo: ["task-a", "task-b"] },
          { title: "Task 2", relatedTo: ["task-c"] },
        ],
        mockRecordSchema,
      );
      expect(yaml).not.toContain("[");
      expect(yaml).toContain("relatedTo:\n      - task-a\n      - task-b");
      expect(yaml).toContain("relatedTo:\n      - task-c");
    });

    it("renders newline-delimited field as block list", () => {
      const yaml = renderYamlEntity(
        { aliases: ["Alpha", "Beta"] },
        mockRecordSchema,
      );
      expect(yaml).toContain("aliases:\n  - Alpha\n  - Beta");
    });

    it("renders blankline-delimited field as block list", () => {
      const yaml = renderYamlEntity(
        { notes: ["First note", "Second note"] },
        mockRecordSchema,
      );
      expect(yaml).toContain("notes:\n  - First note\n  - Second note");
    });
  });

  describe("scalar fields", () => {
    it("renders string values", () => {
      const yaml = renderYamlEntity({ title: "My Task" });
      expect(yaml).toContain("title: My Task");
    });

    it("renders single relation value as scalar", () => {
      const yaml = renderYamlEntity(
        { title: "Task", project: "proj-1" },
        mockRecordSchema,
      );
      expect(yaml).toContain("project: proj-1");
    });
  });

  describe("list rendering", () => {
    it("wraps items in an items key", () => {
      const yaml = renderYamlList([{ title: "Task 1" }]);
      expect(yaml).toContain("items:");
      expect(yaml).toContain("title: Task 1");
    });

    it("adds blank line between list items", () => {
      const yaml = renderYamlList([{ title: "Task 1" }, { title: "Task 2" }]);
      const lines = yaml.split("\n");
      const secondItemIndex = lines.findIndex((l) => l.includes("Task 2"));
      const dashIndex = lines.findLastIndex(
        (l, i) => i < secondItemIndex && l.trim().startsWith("-"),
      );
      expect(dashIndex).toBeGreaterThan(0);
    });

    it("renders empty list", () => {
      const yaml = renderYamlList([]);
      expect(yaml).toContain("items: []");
    });
  });

  describe("round-trip stability", () => {
    it("round-trips entity with relation fields", () => {
      const entity = {
        title: "Task",
        project: "proj-1",
        relatedTo: ["task-a", "task-b"],
        tags: ["bug", "urgent"],
      };
      const rendered = renderYamlEntity(entity, mockRecordSchema);
      const parsed = parseYamlEntity(rendered);
      expect(parsed.data).toEqual(entity);
      expect(renderYamlEntity(parsed.data!, mockRecordSchema)).toEqual(
        rendered,
      );
    });

    it("round-trips list with relation fields", () => {
      const items = [
        { title: "Task 1", relatedTo: ["task-a"] },
        { title: "Task 2", relatedTo: ["task-b", "task-c"] },
      ];
      const rendered = renderYamlList(items, mockRecordSchema);
      const parsed = parseYamlList(rendered);
      expect(parsed.data).toEqual(items);
    });
  });

  describe("without schema", () => {
    it("renders all arrays with default heuristics when no schema given", () => {
      const yaml = renderYamlEntity({ relatedTo: ["a", "b"] });
      expect(yaml).toContain("[ a, b ]");
    });
  });

  describe("parseYamlEntity", () => {
    it("parses valid YAML", () => {
      const result = parseYamlEntity("title: Hello\nstatus: active\n");
      expect(result.data).toEqual({ title: "Hello", status: "active" });
    });

    it("returns error for invalid YAML", () => {
      const result = parseYamlEntity("key: [unclosed");
      expect(result.error).toBeDefined();
    });
  });

  describe("parseYamlList", () => {
    it("parses items from YAML list", () => {
      const result = parseYamlList(
        "items:\n  - title: Task 1\n  - title: Task 2\n",
      );
      expect(result.data).toEqual([{ title: "Task 1" }, { title: "Task 2" }]);
    });

    it("returns error for invalid YAML", () => {
      const result = parseYamlList("items: [unclosed");
      expect(result.error).toBeDefined();
    });
  });

  describe("findEntityInYamlList", () => {
    const yaml = `- key: task-1
  title: First
- key: task-2
  title: Second
- uid: abc-123
  title: Third`;

    it("finds entity by key", () => {
      expect(findEntityInYamlList(yaml, "task-2", undefined)).toBe(2);
    });

    it("finds entity by uid", () => {
      expect(findEntityInYamlList(yaml, undefined, "abc-123")).toBe(4);
    });

    it("returns 0 for first entity", () => {
      expect(findEntityInYamlList(yaml, "task-1", undefined)).toBe(0);
    });

    it("returns 0 when entity not found", () => {
      expect(findEntityInYamlList(yaml, "missing", undefined)).toBe(0);
    });

    it("returns 0 when both key and uid are undefined", () => {
      expect(findEntityInYamlList(yaml, undefined, undefined)).toBe(0);
    });
  });
});
