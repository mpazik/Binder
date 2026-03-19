import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  binderDir,
  createRunHelpers,
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

  const writeDoc = (relPath: string, content: string) =>
    writeFile(join(dir, "docs", relPath), content);

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
