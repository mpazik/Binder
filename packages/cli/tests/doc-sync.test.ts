import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  binderDir,
  createRunHelpers,
  run,
  setupWorkspace,
  teardownWorkspace,
} from "./setup.ts";

describe("Doc Sync", () => {
  let dir: string;
  const { check, checkError } = createRunHelpers(() => dir);

  beforeAll(async () => {
    dir = await setupWorkspace({ docs: true });
  });

  afterAll(async () => {
    await teardownWorkspace(dir);
  });

  const readDoc = (relPath: string) =>
    readFile(join(dir, "docs", relPath), "utf-8");

  const writeDoc = async (relPath: string, content: string) => {
    const fullPath = join(dir, "docs", relPath);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content);
  };

  const docExists = (relPath: string) =>
    Bun.file(join(dir, "docs", relPath)).exists();

  describe("render", () => {
    it("creates files for seeded entities", async () => {
      await check(["docs", "render"]);
      expect(await docExists("tasks/task-implement-user-auth.md")).toBe(true);
      expect(await docExists("tasks/task-implement-auth.md")).toBe(true);
      expect(await docExists("tasks/task-create-api.md")).toBe(true);
      expect(await docExists("projects/project-binder-system.md")).toBe(true);
    });

    it("file content matches DB data", async () => {
      const content = await readDoc("tasks/task-implement-user-auth.md");
      expect(content).toContain("Implement user authentication");
      expect(content).toContain("task-implement-user-auth");
    });

    it("create via CLI auto-renders new file", async () => {
      await check([
        "create",
        "Task",
        "title=Auto-rendered task",
        "key=task-auto-rendered",
      ]);

      expect(await docExists("tasks/task-auto-rendered.md")).toBe(true);
      const content = await readDoc("tasks/task-auto-rendered.md");
      expect(content).toContain("Auto-rendered task");
    });
  });

  describe("sync", () => {
    it("edit file on disk and sync back updates DB", async () => {
      const original = await readDoc("tasks/task-implement-user-auth.md");
      const edited = original.replace(
        "Implement user authentication",
        "Updated via file edit",
      );
      await writeDoc("tasks/task-implement-user-auth.md", edited);

      await check(["docs", "sync"]);

      await check(
        ["read", "task-implement-user-auth", "--format", "json"],
        (stdout) => {
          expect(JSON.parse(stdout)).toMatchObject({
            title: "Updated via file edit",
          });
        },
      );
    });

    it("with explicit path detects changes", async () => {
      const original = await readDoc("tasks/task-implement-auth.md");
      const edited = original.replace(
        "Implement schema generator",
        "Edited via explicit path",
      );
      await writeDoc("tasks/task-implement-auth.md", edited);

      await check(
        ["docs", "sync", "docs/tasks/task-implement-auth.md"],
        "Synchronized",
      );

      await check(
        ["read", "task-implement-auth", "--format", "json"],
        (stdout) => {
          expect(JSON.parse(stdout)).toMatchObject({
            title: "Edited via explicit path",
          });
        },
      );
    });

    it("new file creates entity and re-renders", async () => {
      // Empty file -> entity created from where + path, file backfilled
      await writeDoc("teams/team-new.yaml", "");
      await check(["docs", "sync"]);
      await check(["read", "team-new", "--format", "json"], (stdout) => {
        expect(JSON.parse(stdout)).toMatchObject({
          type: "Team",
          key: "team-new",
        });
      });
      const rendered = await readDoc("teams/team-new.yaml");
      expect(rendered).toContain("key: team-new");

      // File with content -> entity created with extracted fields
      await writeDoc("tasks-yaml/task-from-file.yaml", "title: From File\n");
      await check(["docs", "sync"]);
      await check(["read", "task-from-file", "--format", "json"], (stdout) => {
        expect(JSON.parse(stdout)).toMatchObject({
          type: "Task",
          key: "task-from-file",
          title: "From File",
        });
      });

      // Wrong data type -> rejected
      await writeDoc("tasks-yaml/task-bad.yaml", "title: 123\n");
      await checkError(["docs", "sync"], "Expected string");
    });
  });

  describe("lint", () => {
    it("clean docs exits 0", async () => {
      await check(["docs", "lint", "--config"]);
    });

    it("invalid config file reports error", async () => {
      const typesPath = join(dir, binderDir, "types.yaml");
      const original = await readFile(typesPath, "utf-8");

      await writeFile(typesPath, "items:\n  - key: [[[broken\n");
      await checkError(["docs", "lint", "--config"]);

      await writeFile(typesPath, original);
    });

    it("malformed YAML frontmatter in doc file reports error", async () => {
      const docPath = "tasks/task-implement-user-auth.md";
      const original = await readDoc(docPath);

      await writeDoc(docPath, "---\nstatus: [[[broken\n---\n\nBody\n");
      const result = await run(["docs", "lint"], { cwd: dir });
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain("task-implement-user-auth.md");
      expect(result.stdout).toContain("yaml-syntax-error");

      await writeDoc(docPath, original);
    });
  });
});
