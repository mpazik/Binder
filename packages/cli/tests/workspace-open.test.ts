import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { binderDir, run, setupWorkspace, teardownWorkspace } from "./setup.ts";

// The script runner selects the same runtime as workspace initialization.
const workspaceEntry = process.env.BINDER_CLI
  ? "@binder.do/cli/workspace"
  : new URL("../src/workspace.ts", import.meta.url).href;

const runWorkspaceScript = async (dir: string, source: string) => {
  const scripts = join(dir, binderDir, "scripts");
  await mkdir(scripts, { recursive: true });
  await writeFile(
    join(scripts, "workspace-test.ts"),
    `
import { openWorkspace, isErr } from ${JSON.stringify(workspaceEntry)};
${source}
`,
  );
  const result = await run(["run", "workspace-test"], { cwd: dir });
  expect(result.stderr).toBe("");
  expect(result.exitCode).toBe(0);
  return result.stdout;
};

describe("openWorkspace", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await setupWorkspace({ docs: true });
  });

  afterAll(async () => {
    await teardownWorkspace(dir);
  });

  it("stamps transaction provenance with clientId, renders docs, and close() is idempotent", async () => {
    const stdout = await runWorkspaceScript(
      dir,
      `
const result = await openWorkspace({ clientId: "my-test-script" });
if (isErr(result)) throw new Error(JSON.stringify(result.error));
const { kg, config, close } = result.data;
try {
  const tx = await kg.update({
    author: "test",
    records: [{ key: "ws-open-test-1", type: "Task", title: "Workspace open test" }],
  });
  if (isErr(tx)) throw new Error(JSON.stringify(tx.error));
  console.log(JSON.stringify(config.paths));
} finally {
  await close();
  await close();
}
`,
    );
    const paths = JSON.parse(stdout.trim());
    expect(paths.root).toBeTruthy();
    const txLog = await readFile(
      join(paths.data, "transactions.jsonl"),
      "utf-8",
    );
    const lines = txLog.trim().split("\n");
    expect(JSON.parse(lines[lines.length - 1]!).source).toBe("my-test-script");
    const docContent = await readFile(
      join(paths.docs, "tasks", "ws-open-test-1.md"),
      "utf-8",
    );
    expect(docContent).toContain("Workspace open test");
    await expect(
      readFile(join(paths.binder, "logs", "my-test-script.log"), "utf-8"),
    ).resolves.toBeString();
  });

  it("fails when clientId is not kebab-case", async () => {
    const stdout = await runWorkspaceScript(
      dir,
      `
const result = await openWorkspace({ clientId: "../../etc/passwd" });
if (!isErr(result)) {
  await result.data.close();
  throw new Error("Expected invalid client ID to fail");
}
console.log(result.error.key);
`,
    );
    expect(stdout.trim()).toBe("invalid-client-id");
  });
});
