import { describe, expect, it } from "bun:test";
import { mockRecordSchema } from "@binder/db/mocks";
import {
  renderYamlEntity,
  renderYamlList,
  parseYamlEntity,
  parseYamlList,
} from "./yaml.ts";

describe("yaml rendering", () => {
  describe("relation fields use block lists", () => {
    it("renders a single relation value as block list", () => {
      const yaml = renderYamlEntity(
        { title: "Task", project: "proj-1" },
        mockRecordSchema,
      );
      expect(yaml).toContain("project: proj-1");
    });

    it("renders a multi-value relation field as block list, not inline", () => {
      const yaml = renderYamlEntity(
        { title: "Task", relatedTo: ["task-a", "task-b"] },
        mockRecordSchema,
      );
      expect(yaml).not.toContain("[");
      expect(yaml).toContain("relatedTo:\n  - task-a\n  - task-b");
    });

    it("renders relation fields as block list even when short", () => {
      const yaml = renderYamlEntity({ relatedTo: ["a"] }, mockRecordSchema);
      expect(yaml).not.toContain("[");
      expect(yaml).toContain("relatedTo:\n  - a");
    });

    it("renders relation fields as block list in yaml list items", () => {
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
  });

  describe("non-comma-delimited multi-value fields use block lists", () => {
    it("renders newline-delimited field as block list", () => {
      // aliases is plaintext/line with allowMultiple (delimiter: newline)
      const yaml = renderYamlEntity(
        { aliases: ["Alpha", "Beta"] },
        mockRecordSchema,
      );
      expect(yaml).toContain("aliases:\n  - Alpha\n  - Beta");
    });

    it("renders blankline-delimited field as block list", () => {
      // notes is plaintext/paragraph with allowMultiple (delimiter: blankline)
      const yaml = renderYamlEntity(
        { notes: ["First note", "Second note"] },
        mockRecordSchema,
      );
      expect(yaml).toContain("notes:\n  - First note\n  - Second note");
    });
  });

  describe("comma-delimited multi-value fields keep inline formatting", () => {
    it("renders short comma-delimited arrays inline", () => {
      // tags is plaintext/identifier with allowMultiple (delimiter: comma)
      const yaml = renderYamlEntity(
        { title: "Task", tags: ["bug", "urgent"] },
        mockRecordSchema,
      );
      expect(yaml).toContain("tags: [ bug, urgent ]");
    });
  });

  describe("round-trip stability", () => {
    it("round-trips entity with relation fields through render and parse", () => {
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

    it("round-trips list with relation fields through render and parse", () => {
      const items = [
        { title: "Task 1", relatedTo: ["task-a"] },
        { title: "Task 2", relatedTo: ["task-b", "task-c"] },
      ];
      const rendered = renderYamlList(items, mockRecordSchema);
      const parsed = parseYamlList(rendered);
      expect(parsed.data).toEqual(items);
    });
  });

  describe("without schema (backward compat)", () => {
    it("renders all arrays with default heuristics when no schema given", () => {
      const yaml = renderYamlEntity({ relatedTo: ["a", "b"] });
      expect(yaml).toContain("[ a, b ]");
    });
  });
});
