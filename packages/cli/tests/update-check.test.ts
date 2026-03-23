import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const CLI_ENTRY = resolve(REPO_ROOT, "packages/cli/src/index.ts");

const getCommand = (): string[] => {
  const env = process.env.BINDER_CLI;
  if (!env) return ["bun", "run", CLI_ENTRY];
  const parts = env.trim().split(/\s+/);
  if (parts.length === 1 && parts[0] === "binder") {
    // eslint-disable-next-line no-restricted-syntax -- test guard, not runtime error handling
    throw new Error(
      "BINDER_CLI=binder would run the globally installed binary.",
    );
  }
  return parts;
};

const CMD = getCommand();

const runCli = async (args: string[], env: Record<string, string>) => {
  const result = await $`${CMD} ${args}`
    .env({ ...process.env, ...env })
    .nothrow()
    .quiet();
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
};

/** Start a mock npm registry that always returns the given version. */
const startMockRegistry = (version: string): Promise<Server> =>
  new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ version }));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });

const registryUrl = (server: Server): string => {
  const addr = server.address();
  // eslint-disable-next-line no-restricted-syntax -- test guard, not runtime error handling
  if (!addr || typeof addr === "string") throw new Error("unexpected address");
  return `http://127.0.0.1:${addr.port}`;
};

describe("update-check", () => {
  let server: Server;
  let stateDir: string;
  let baseEnv: Record<string, string>;

  beforeAll(async () => {
    server = await startMockRegistry("99.0.0");
    stateDir = await mkdtemp(join(tmpdir(), "binder-update-check-"));
    baseEnv = {
      BINDER_REGISTRY_URL: registryUrl(server),
      XDG_STATE_HOME: stateDir,
    };
  });

  afterAll(async () => {
    server.close();
    await rm(stateDir, { recursive: true, force: true });
  });

  it("first run triggers background fetch but shows no notification", async () => {
    const result = await runCli(["--version"], baseEnv);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("Update available");
  });

  it("second run shows update notification on stderr", async () => {
    // Small delay to let the background fetch from the first run complete.
    await Bun.sleep(500);

    const result = await runCli(["--version"], baseEnv);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Update available");
    expect(result.stderr).toContain("99.0.0");
  });

  it("cache file exists at expected path", async () => {
    const cachePath = join(stateDir, "binder", "update-check.json");
    const cache = JSON.parse(await readFile(cachePath, "utf-8"));
    expect(cache).toHaveProperty("latestVersion", "99.0.0");
    expect(cache).toHaveProperty("lastCheck");
  });

  it("no notification when BINDER_SKIP_UPDATE_CHECK=1", async () => {
    const result = await runCli(["--version"], {
      ...baseEnv,
      BINDER_SKIP_UPDATE_CHECK: "1",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("Update available");
  });
});
