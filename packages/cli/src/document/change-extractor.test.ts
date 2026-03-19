import { dirname, join } from "path";
import { beforeEach, describe, expect, it } from "bun:test";
import { pick, throwIfError } from "@binder/utils";
import "@binder/utils/tests";
import { type EntityChangesetInput, type KnowledgeGraph } from "@binder/db";
import {
  mockRecordSchema,
  mockProjectRecord,
  mockProjectUid,
  mockTask1Record,
  mockTask1Uid,
  mockTask2Record,
  mockTask2Uid,
  mockTask3Record,
  mockTask3Uid,
  mockProjectType,
  mockTaskType,
  mockTaskTypeKey,
  mockTeamType,
  mockTransactionInitInput,
  mockUserType,
} from "@binder/db/mocks";
import { createMockRuntimeContextWithDb } from "../runtime.mock.ts";
import type { RuntimeContextWithDb } from "../runtime.ts";
import { mockDocumentTransactionInput } from "./document.mock.ts";
import { mockNavigationConfigInput } from "./navigation.mock.ts";
import {
  extractFileChanges,
  extractModifiedFileChanges,
} from "./change-extractor.ts";
import { renderYamlEntity, renderYamlList } from "./yaml.ts";
import { type NavigationItem } from "./navigation.ts";
import {
  mockPreambleStatusInBodyTemplate,
  mockPreambleTemplate,
  mockTemplates,
} from "./template.mock.ts";
import { createTemplateEntity } from "./template-entity.ts";

const navigationItems: NavigationItem[] = [
  {
    path: "tasks/{key}",
    template: "task-template",
  },
  {
    path: "tasks/{key}",
    includes: { title: true, status: true, description: true },
  },
  {
    path: "all-tasks",
    query: { filters: { type: "Task" } },
  },
  {
    path: "projects/{key}",
    includes: {
      title: true,
      status: true,
      tasks: { title: true, status: true },
    },
  },
];

const taskMarkdown = (
  title: string,
  status: string,
  description: string,
) => `# ${title}

**Status:** ${status}

## Description

${description}
`;

describe("change-extractor", () => {
  let ctx: RuntimeContextWithDb;
  let kg: KnowledgeGraph;

  beforeEach(async () => {
    ctx = await createMockRuntimeContextWithDb();
    kg = ctx.kg;
    throwIfError(await kg.update(mockTransactionInitInput));
    throwIfError(await kg.update(mockDocumentTransactionInput));
  });

  const check = async (
    filePath: string,
    content: string,
    expectedNodes: EntityChangesetInput<"record">[],
  ) => {
    const fullPath = join(ctx.config.paths.docs, filePath);
    throwIfError(await ctx.fs.mkdir(dirname(fullPath), { recursive: true }));
    throwIfError(await ctx.fs.writeFile(fullPath, content));
    const result = throwIfError(
      await extractFileChanges(
        ctx.fs,
        kg,
        ctx.config,
        navigationItems,
        mockRecordSchema,
        filePath,
        "record",
        mockTemplates,
      ),
    );
    expect(result).toEqual(expectedNodes);
  };

  describe("markdown task", () => {
    it("returns empty array when no changes", async () => {
      await check(
        `tasks/${mockTask1Record.key}.md`,
        taskMarkdown(
          mockTask1Record.title,
          mockTask1Record.status,
          mockTask1Record.description,
        ),
        [],
      );
    });

    it("detects field changes", async () => {
      await check(
        `tasks/${mockTask1Record.key}.md`,
        taskMarkdown("Updated Task Title", "done", "New description text"),
        [
          {
            $ref: mockTask1Uid,
            title: "Updated Task Title",
            status: "done",
            description: "New description text",
          },
        ],
      );
    });
  });

  describe("markdown with preamble", () => {
    it("propagates field-conflict when frontmatter and body diverge", async () => {
      const preambleTemplates = [
        mockPreambleTemplate,
        mockPreambleStatusInBodyTemplate,
        ...mockTemplates,
      ];
      const preambleNavItems: NavigationItem[] = [
        { path: "tasks/{key}", template: "task-status-body" },
      ];
      const markdown = `---
status: active
---

# ${mockTask1Record.title}

**Status:** done
`;
      const filePath = `tasks/${mockTask1Record.key}.md`;
      const fullPath = join(ctx.config.paths.docs, filePath);
      throwIfError(await ctx.fs.mkdir(dirname(fullPath), { recursive: true }));
      throwIfError(await ctx.fs.writeFile(fullPath, markdown));
      const result = await extractFileChanges(
        ctx.fs,
        kg,
        ctx.config,
        preambleNavItems,
        mockRecordSchema,
        filePath,
        "record",
        preambleTemplates,
      );
      expect(result).toBeErrWithKey("field-conflict");
    });

    it("does not produce changeset for preamble relation field absent from frontmatter", async () => {
      // Reproduction for fix-sync-oscillates-inverse-relations:
      // task2 has project: mockProjectUid in DB. The template includes
      // "project" in its preamble. But the markdown frontmatter omits
      // "project". The sync should NOT produce a changeset nulling it out.
      const preambleProjectTemplate = createTemplateEntity(
        "task-preamble-project",
        `# {title}\n\n**Status:** {status}\n\n## Description\n\n{description}\n`,
        { preamble: ["status", "project"] },
      );
      const preambleTemplates = [preambleProjectTemplate, ...mockTemplates];
      const preambleNavItems: NavigationItem[] = [
        { path: "tasks/{key}", template: "task-preamble-project" },
      ];
      // Frontmatter has status but NOT project
      const markdown = `---
status: ${mockTask2Record.status}
---

# ${mockTask2Record.title}

**Status:** ${mockTask2Record.status}

## Description

${mockTask2Record.description}
`;
      const filePath = `tasks/${mockTask2Record.key}.md`;
      const fullPath = join(ctx.config.paths.docs, filePath);
      throwIfError(await ctx.fs.mkdir(dirname(fullPath), { recursive: true }));
      throwIfError(await ctx.fs.writeFile(fullPath, markdown));
      const result = throwIfError(
        await extractFileChanges(
          ctx.fs,
          kg,
          ctx.config,
          preambleNavItems,
          mockRecordSchema,
          filePath,
          "record",
          preambleTemplates,
        ),
      );
      expect(result).toEqual([]);
    });
  });

  describe("yaml single entity", () => {
    it("returns empty array when no changes", async () => {
      await check(
        `tasks/${mockTask1Record.key}.yaml`,
        renderYamlEntity(
          pick(mockTask1Record, ["title", "status", "description"]),
        ),
        [],
      );
    });

    it("detects field changes", async () => {
      await check(
        `tasks/${mockTask1Record.key}.yaml`,
        renderYamlEntity({
          title: "Updated Task Title",
          status: "done",
          description: mockTask1Record.description,
        }),
        [{ $ref: mockTask1Uid, title: "Updated Task Title", status: "done" }],
      );
    });
  });

  describe("yaml with nested includes", () => {
    beforeEach(async () => {
      throwIfError(
        await kg.update({
          author: "test",
          records: [
            pick(mockTask3Record, [
              "uid",
              "type",
              "title",
              "status",
              "project",
            ]),
          ],
        }),
      );
    });

    it("detects removed task from project", async () => {
      await check(
        `projects/${mockProjectRecord.key}.yaml`,
        renderYamlEntity({
          ...pick(mockProjectRecord, ["title", "status"]),
          tasks: [pick(mockTask2Record, ["uid", "title", "status"])],
        }),
        [{ $ref: mockProjectUid, tasks: [["remove", mockTask3Uid]] }],
      );
    });
  });

  describe("yaml list", () => {
    it("returns empty array when no changes", async () => {
      await check(
        "all-tasks.yaml",
        renderYamlList([mockTask1Record, mockTask2Record]),
        [],
      );
    });

    it("detects new items in list", async () => {
      await check(
        "all-tasks.yaml",
        renderYamlList([
          mockTask1Record,
          mockTask2Record,
          { type: mockTaskTypeKey, title: "New Task", status: "todo" },
        ]),
        [{ type: mockTaskTypeKey, title: "New Task", status: "todo" }],
      );
    });

    it("detects multiple changes", async () => {
      await check(
        "all-tasks.yaml",
        renderYamlList([
          { ...mockTask1Record, title: "Modified Task 1" },
          { ...mockTask2Record, status: "done" },
        ]),
        [
          { $ref: mockTask1Uid, title: "Modified Task 1" },
          { $ref: mockTask2Uid, status: "done" },
        ],
      );
    });

    it("detects removal of entity from list", async () => {
      await check("all-tasks.yaml", renderYamlList([mockTask1Record]), [
        { $ref: mockTask2Uid, $delete: true },
      ]);
    });
  });

  describe("synchronizeModifiedFiles", () => {
    beforeEach(async () => {
      throwIfError(
        await kg.update({
          author: "test",
          configs: mockNavigationConfigInput,
        }),
      );
    });

    const check = async (
      filePath: string,
      content: string,
      expected: Record<string, unknown> | null,
    ) => {
      throwIfError(await ctx.fs.writeFile(filePath, content));
      const result = throwIfError(
        await extractModifiedFileChanges(ctx, filePath),
      );
      if (expected === null) {
        expect(result).toEqual(null);
      } else {
        expect(result).toMatchObject(expected);
      }
    };

    it("returns null when no modified files in docs folder", async () => {
      const result = throwIfError(
        await extractModifiedFileChanges(ctx, ctx.config.paths.docs),
      );
      expect(result).toEqual(null);
    });

    it("detects changes in a single modified file", async () => {
      await check(
        join(ctx.config.paths.docs, "all-tasks.yaml"),
        renderYamlList([{ ...mockTask1Record, title: "Updated Title" }]),
        {
          author: ctx.config.author,
          records: [
            { $ref: mockTask1Uid, title: "Updated Title" },
            { $ref: mockTask2Uid, $delete: true },
          ],
          configs: [],
        },
      );
    });

    it("detects changes when scoped to specific file", async () => {
      await check(
        join(ctx.config.paths.docs, "all-tasks.yaml"),
        renderYamlList([{ ...mockTask1Record, title: "Scoped Update" }]),
        {
          records: [
            { $ref: mockTask1Uid, title: "Scoped Update" },
            { $ref: mockTask2Uid, $delete: true },
          ],
        },
      );
    });

    describe("conflict detection", () => {
      it("detects conflict when two files change same entity field to different values", async () => {
        const yamlPath = join(
          ctx.config.paths.docs,
          `tasks/${mockTask1Record.key}.yaml`,
        );
        const mdPath = join(
          ctx.config.paths.docs,
          `md-tasks/${mockTask1Record.key}.md`,
        );

        throwIfError(
          await ctx.fs.mkdir(dirname(yamlPath), { recursive: true }),
        );
        throwIfError(await ctx.fs.mkdir(dirname(mdPath), { recursive: true }));

        throwIfError(
          await ctx.fs.writeFile(
            yamlPath,
            renderYamlEntity({
              title: "Title From YAML",
              status: mockTask1Record.status,
            }),
          ),
        );
        throwIfError(
          await ctx.fs.writeFile(
            mdPath,
            `---
status: ${mockTask1Record.status}
---

# Title From Markdown

## Description

${mockTask1Record.description}
`,
          ),
        );

        const result = await extractModifiedFileChanges(
          ctx,
          ctx.config.paths.docs,
        );
        expect(result).toBeErrWithKey("field-conflict");
      });

      it("detects conflict when one file deletes and another updates same entity", async () => {
        const listPath = join(ctx.config.paths.docs, "all-tasks.yaml");
        const itemPath = join(
          ctx.config.paths.docs,
          `tasks/${mockTask2Record.key}.yaml`,
        );

        throwIfError(
          await ctx.fs.writeFile(listPath, renderYamlList([mockTask1Record])),
        );
        throwIfError(
          await ctx.fs.writeFile(
            itemPath,
            renderYamlEntity({
              title: "Task 2 Updated",
              status: mockTask2Record.status,
              description: mockTask2Record.description,
            }),
          ),
        );

        const result = await extractModifiedFileChanges(
          ctx,
          ctx.config.paths.docs,
        );
        expect(result).toBeErrWithKey("field-conflict");
      });
    });

    describe("config namespace", () => {
      it("detects changes", async () => {
        await check(
          join(ctx.config.paths.binder, "types.yaml"),
          renderYamlList([{ ...mockTaskType, name: "Updated Task Type" }]),
          {
            records: [],
            configs: expect.arrayContaining([
              { $ref: mockTaskType.uid, name: "Updated Task Type" },
              { $ref: mockProjectType.uid, $delete: true },
              { $ref: mockUserType.uid, $delete: true },
              { $ref: mockTeamType.uid, $delete: true },
            ]),
          },
        );
      });

      it("detects removal of entity from list", async () => {
        await check(
          join(ctx.config.paths.binder, "types.yaml"),
          renderYamlList([mockTaskType, mockProjectType]),
          {
            records: [],
            configs: expect.arrayContaining([
              { $ref: mockUserType.uid, $delete: true },
              { $ref: mockTeamType.uid, $delete: true },
            ]),
          },
        );
      });

      it("keeps key when creating entity from list", async () => {
        const newType = {
          ...mockTaskType,
          uid: "_new_type" as typeof mockTaskType.uid,
          key: "EpicType",
          name: "Epic Type",
        };

        await check(
          join(ctx.config.paths.binder, "types.yaml"),
          renderYamlList([
            mockTaskType,
            mockProjectType,
            mockUserType,
            mockTeamType,
            newType,
          ]),
          {
            records: [],
            configs: expect.arrayContaining([
              expect.objectContaining({
                type: mockTaskType.type,
                key: "EpicType",
                name: "Epic Type",
              }),
            ]),
          },
        );
      });

      it("returns null when TypeFieldRef tuples are unchanged", async () => {
        await check(
          join(ctx.config.paths.binder, "types.yaml"),
          renderYamlList([
            mockTaskType,
            mockProjectType,
            mockUserType,
            mockTeamType,
          ]),
          null,
        );
      });
    });
  });

  describe("path sanitization", () => {
    const checkSanitizedPath = async (
      taskUid: typeof mockTask1Uid,
      record: { title: string; status: string; description: string },
      navItems: NavigationItem[],
      filePath: string,
      fileContent: string,
      expected: EntityChangesetInput<"record">[],
    ) => {
      throwIfError(
        await kg.update({
          author: "test",
          records: [{ uid: taskUid, type: mockTaskTypeKey, ...record }],
        }),
      );
      const fullPath = join(ctx.config.paths.docs, filePath);
      throwIfError(await ctx.fs.mkdir(dirname(fullPath), { recursive: true }));
      throwIfError(await ctx.fs.writeFile(fullPath, fileContent));
      const result = await extractFileChanges(
        ctx.fs,
        kg,
        ctx.config,
        navItems,
        mockRecordSchema,
        filePath,
        "record",
        mockTemplates,
        undefined,
        taskUid,
      );
      expect(result).toBeOk();
      expect(throwIfError(result)).toEqual(expected);
    };

    it("resolves entity when path field value contains colons", async () => {
      const taskUid = "_taskColon0" as typeof mockTask1Uid;
      await checkSanitizedPath(
        taskUid,
        { title: "1:1 Meeting", status: "pending", description: "Weekly sync" },
        [
          {
            path: "notes/{title}",
            where: { type: "Task", title: "1:1 Meeting" },
            includes: { title: true, status: true, description: true },
          },
        ],
        "notes/1-1 Meeting.yaml",
        renderYamlEntity({
          title: "1:1 Meeting",
          status: "done",
          description: "Weekly sync",
        }),
        [{ $ref: taskUid, status: "done" }],
      );
    });

    it("resolves entity when path field value contains multiple special chars", async () => {
      const taskUid = "_taskSpecCh" as typeof mockTask1Uid;
      await checkSanitizedPath(
        taskUid,
        {
          title: 'Q&A: "Why?" <explained>',
          status: "pending",
          description: "Special chars test",
        },
        [
          {
            path: "notes/{title}",
            where: { type: "Task", title: 'Q&A: "Why?" <explained>' },
            includes: { title: true, status: true, description: true },
          },
        ],
        "notes/Q&A- -Why-- -explained-.yaml",
        renderYamlEntity({
          title: 'Q&A: "Why?" <explained>',
          status: "done",
          description: "Special chars test",
        }),
        [{ $ref: taskUid, status: "done" }],
      );
    });

    it("resolves entity for markdown files with sanitized path", async () => {
      const taskUid = "_taskSanMd0" as typeof mockTask1Uid;
      await checkSanitizedPath(
        taskUid,
        {
          title: "Design: Phase 1",
          status: "pending",
          description: "First phase",
        },
        [
          {
            path: "tasks/{title}",
            where: { type: "Task", title: "Design: Phase 1" },
            template: "task-template",
          },
        ],
        "tasks/Design- Phase 1.md",
        taskMarkdown("Design: Phase 1", "done", "First phase"),
        [{ $ref: taskUid, status: "done" }],
      );
    });

    it("returns no changes when sanitized path file is unchanged", async () => {
      const taskUid = "_taskNoCh00" as typeof mockTask1Uid;
      await checkSanitizedPath(
        taskUid,
        {
          title: "Topic: Overview",
          status: "pending",
          description: "Summary",
        },
        [
          {
            path: "notes/{title}",
            where: { type: "Task", title: "Topic: Overview" },
            includes: { title: true, status: true, description: true },
          },
        ],
        "notes/Topic- Overview.yaml",
        renderYamlEntity({
          title: "Topic: Overview",
          status: "pending",
          description: "Summary",
        }),
        [],
      );
    });

    it("still works for paths without sanitized characters", async () => {
      await check(
        `tasks/${mockTask1Record.key}.yaml`,
        renderYamlEntity({
          title: "Updated Title",
          status: mockTask1Record.status,
          description: mockTask1Record.description,
        }),
        [{ $ref: mockTask1Uid, title: "Updated Title" }],
      );
    });
  });
});
