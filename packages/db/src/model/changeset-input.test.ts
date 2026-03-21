import { describe, it, expect } from "bun:test";
import {
  normalizeInput,
  type EntityChangesetInput,
} from "./changeset-input.ts";
import { mockRecordSchema } from "./schema.mock.ts";
import {
  mockChaptersFieldKey,
  mockMembersFieldKey,
  mockTaskTypeKey,
  mockTeamTypeKey,
} from "./config.mock.ts";
import { mockUserUid } from "./record.mock.ts";
import { tagsFieldKey } from "./schema.ts";

describe("changeset-input", () => {
  describe("normalizeInput", () => {
    describe("allowMultiple plaintext identifier field", () => {
      it("normalizes single value to array", () => {
        const input: EntityChangesetInput<"record"> = {
          type: mockTaskTypeKey,
          title: "Test Task",
          [tagsFieldKey]: "single-tag",
        };
        const result = normalizeInput(input, mockRecordSchema);
        expect(result).toMatchObject({ [tagsFieldKey]: ["single-tag"] });
      });

      it("normalizes comma-separated string to array", () => {
        const input: EntityChangesetInput<"record"> = {
          type: mockTaskTypeKey,
          title: "Test Task",
          [tagsFieldKey]: "tag1, tag2, tag3",
        };
        const result = normalizeInput(input, mockRecordSchema);
        expect(result).toMatchObject({
          [tagsFieldKey]: ["tag1", "tag2", "tag3"],
        });
      });

      it("preserves array values", () => {
        const input: EntityChangesetInput<"record"> = {
          type: mockTaskTypeKey,
          title: "Test Task",
          [tagsFieldKey]: ["a", "b"],
        };
        const result = normalizeInput(input, mockRecordSchema);
        expect(result).toMatchObject({ [tagsFieldKey]: ["a", "b"] });
      });

      it("filters empty items when splitting by delimiter", () => {
        const input: EntityChangesetInput<"record"> = {
          type: mockTaskTypeKey,
          title: "Test Task",
          [tagsFieldKey]: "a,,b",
        };
        const result = normalizeInput(input, mockRecordSchema);
        expect(result).toMatchObject({ [tagsFieldKey]: ["a", "b"] });
      });
    });

    it("does not split non-allowMultiple fields", () => {
      const input: EntityChangesetInput<"record"> = {
        type: mockTaskTypeKey,
        title: "Title, with comma",
      };
      const result = normalizeInput(input, mockRecordSchema);
      expect(result).toMatchObject({ title: "Title, with comma" });
    });

    it("normalizes ObjTuple to tuple in allowMultiple relation field", () => {
      const input: EntityChangesetInput<"record"> = {
        type: mockTeamTypeKey,
        [mockMembersFieldKey]: [{ [mockUserUid]: { role: "admin" } }],
      };
      const result = normalizeInput(input, mockRecordSchema);
      expect(result).toMatchObject({
        [mockMembersFieldKey]: [[mockUserUid, { role: "admin" }]],
      });
    });

    it("splits string by delimiter for allowMultiple richtext document fields", () => {
      // Document format uses --- as delimiter
      const multiDocContent = `# First Document

Content of first doc.

---

# Second Document

Content of second doc.`;

      const input: EntityChangesetInput<"record"> = {
        type: mockTaskTypeKey,
        title: "Test Task",
        [mockChaptersFieldKey]: multiDocContent as unknown as string[],
      };

      const result = normalizeInput(input, mockRecordSchema);

      expect(result).toMatchObject({
        [mockChaptersFieldKey]: [
          "# First Document\n\nContent of first doc.",
          "# Second Document\n\nContent of second doc.",
        ],
      });
    });

    it("keeps single document without delimiter as single-element array", () => {
      const singleDocContent = `# Single Document

Content without any delimiter.`;

      const input: EntityChangesetInput<"record"> = {
        type: mockTaskTypeKey,
        title: "Test Task",
        [mockChaptersFieldKey]: singleDocContent as unknown as string[],
      };

      const result = normalizeInput(input, mockRecordSchema);

      expect(result).toMatchObject({
        [mockChaptersFieldKey]: [singleDocContent],
      });
    });
  });
});
