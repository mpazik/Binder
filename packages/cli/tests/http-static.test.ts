import { type ChildProcess } from "node:child_process";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupWorkspace, spawnBinder, teardownWorkspace } from "./setup.ts";
import { stopServer, waitForServer } from "./http-helpers.ts";

const SERVER_TS = `import { Hono } from "hono";
import type { ServerModule } from "@binder.do/cli";

const mod: ServerModule = () => {
  const app = new Hono();
  app.get("/api/custom", (c) => c.json({ ok: true, source: "MARKER" }));
  return app;
};

export default mod;
`;

const INDEX_HTML = `<!doctype html><title>custom</title>STATIC_MARKER`;

const provisionHono = async (dir: string): Promise<void> => {
  const modules = join(dir, "node_modules");
  await mkdir(modules, { recursive: true });
  await symlink(
    dirname(fileURLToPath(import.meta.resolve("hono/package.json"))),
    join(modules, "hono"),
    "dir",
  );
};

describe("HTTP server with --static dir and colocated server.ts", () => {
  const PORT = 17_008;
  const BASE = `http://127.0.0.1:${PORT}`;
  let dir: string;
  let server: ChildProcess;

  beforeAll(async () => {
    dir = await setupWorkspace();
    const webDir = join(dir, "web");
    await mkdir(webDir, { recursive: true });
    await writeFile(join(webDir, "index.html"), INDEX_HTML);
    await writeFile(join(webDir, "server.ts"), SERVER_TS);

    await provisionHono(dir);
    server = spawnBinder("http", {
      cwd: dir,
      args: ["--static", "./web", "--port", String(PORT)],
    });
    await waitForServer(server, BASE);
  }, 30_000);

  afterAll(async () => {
    await stopServer(server);
    await teardownWorkspace(dir);
  });

  it("loads server.ts from the static dir and mounts custom routes", async () => {
    const res = await fetch(`${BASE}/api/custom`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("MARKER");
  });

  it("does not serve server.ts as a static asset", async () => {
    const res = await fetch(`${BASE}/server.ts`);
    expect(res.status).toBe(404);
  });

  it("serves index.html from the static dir", async () => {
    const res = await fetch(`${BASE}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("STATIC_MARKER");
  });
});

describe("HTTP server with default .binder/web convention", () => {
  const PORT = 17_009;
  const BASE = `http://127.0.0.1:${PORT}`;
  let dir: string;
  let server: ChildProcess;

  beforeAll(async () => {
    dir = await setupWorkspace();
    const webDir = join(dir, ".binder", "web");
    await mkdir(webDir, { recursive: true });
    await writeFile(join(webDir, "index.html"), INDEX_HTML);
    await writeFile(join(webDir, "server.ts"), SERVER_TS);

    await provisionHono(dir);
    server = spawnBinder("http", { cwd: dir, args: ["--port", String(PORT)] });
    await waitForServer(server, BASE);
  }, 30_000);

  afterAll(async () => {
    await stopServer(server);
    await teardownWorkspace(dir);
  });

  it("loads server.ts from .binder/web by default", async () => {
    const res = await fetch(`${BASE}/api/custom`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; source: string };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("MARKER");
  });

  it("does not serve server.ts as a static asset", async () => {
    const res = await fetch(`${BASE}/server.ts`);
    expect(res.status).toBe(404);
  });

  it("serves index.html from .binder/web", async () => {
    const res = await fetch(`${BASE}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("STATIC_MARKER");
  });
});
