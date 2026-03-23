import { createInterface } from "node:readline";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  createJsonRpcRequest,
  isOk,
  tryCatch,
  type JsonRpcResponse,
} from "@binder/utils";
import { setupWorkspace, teardownWorkspace, spawnBinder } from "./setup.ts";

const PROTOCOL_VERSION = "2025-03-26";

const createMcpClient = (cwd: string) => {
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: JsonRpcResponse) => void }>();

  const child = spawnBinder("mcp", { cwd });
  const rl = createInterface({ input: child.stdout! });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parsed = tryCatch(() => JSON.parse(trimmed) as JsonRpcResponse);
    if (!isOk(parsed)) return;
    const msg = parsed.data;
    if ("id" in msg && msg.id != null && pending.has(msg.id as number)) {
      pending.get(msg.id as number)!.resolve(msg);
      pending.delete(msg.id as number);
    }
  });

  const send = (method: string, params?: unknown): Promise<JsonRpcResponse> => {
    const id = nextId++;
    const request = createJsonRpcRequest(method, params, id);
    return new Promise((resolve) => {
      pending.set(id, { resolve });
      child.stdin!.write(JSON.stringify(request) + "\n");
    });
  };

  const initialize = () =>
    send("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "test-client", version: "0.1.0" },
    });

  const shutdown = () => {
    child.stdin!.end();
    child.kill();
  };

  return { send, initialize, shutdown, process: child };
};

describe("MCP", () => {
  let dir: string;
  let client: ReturnType<typeof createMcpClient>;

  beforeAll(async () => {
    dir = await setupWorkspace();
    client = createMcpClient(dir);
    await client.initialize();
  }, 15_000);

  afterAll(async () => {
    client.shutdown();
    await teardownWorkspace(dir);
  });

  describe("initialize", () => {
    it("returns server info and capabilities", async () => {
      const res = await client.send("initialize", {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.1" },
      });
      expect(res).not.toHaveProperty("error");
      const result = (res as any).result;
      expect(result.protocolVersion).toBe(PROTOCOL_VERSION);
      expect(result.serverInfo.name).toBe("Binder");
      expect(result.capabilities.tools).toBeDefined();
    });
  });

  describe("tools/list", () => {
    it("returns available tools", async () => {
      const res = await client.send("tools/list");
      expect(res).not.toHaveProperty("error");
      const result = (res as any).result as { tools: { name: string }[] };
      const names = result.tools.map((t) => t.name);
      expect(names).toContain("schema");
      expect(names).toContain("search");
      expect(names).toContain("transact");
    });
  });

  describe("schema tool", () => {
    it("returns types and fields", async () => {
      const res = await client.send("tools/call", {
        name: "schema",
        arguments: {},
      });
      expect(res).not.toHaveProperty("error");
      const result = (res as any).result as {
        content: { type: string; text: string }[];
      };
      const text = result.content[0]!.text;
      expect(text).toContain("Task");
      expect(text).toContain("Project");
    });
  });

  describe("search tool", () => {
    it("with type filter returns matching records", async () => {
      const res = await client.send("tools/call", {
        name: "search",
        arguments: { filters: { type: "Task" } },
      });
      expect(res).not.toHaveProperty("error");
      const result = (res as any).result as {
        structuredContent: { items: any[] };
      };
      expect(result.structuredContent.items.length).toBeGreaterThan(0);
      for (const item of result.structuredContent.items) {
        expect(item.type).toBe("Task");
      }
    });

    it("with field filter narrows results", async () => {
      const res = await client.send("tools/call", {
        name: "search",
        arguments: { filters: { type: "Task", status: "pending" } },
      });
      expect(res).not.toHaveProperty("error");
      const result = (res as any).result as {
        structuredContent: { items: any[] };
      };
      for (const item of result.structuredContent.items) {
        expect(item.status).toBe("pending");
      }
    });

    it("with limit caps results", async () => {
      const res = await client.send("tools/call", {
        name: "search",
        arguments: { filters: { type: "Task" }, limit: 1 },
      });
      expect(res).not.toHaveProperty("error");
      const result = (res as any).result as {
        structuredContent: { items: any[] };
      };
      expect(result.structuredContent.items).toEqual([
        expect.objectContaining({ type: "Task" }),
      ]);
    });
  });

  describe("transact tool", () => {
    it("creates a new record", async () => {
      const res = await client.send("tools/call", {
        name: "transact",
        arguments: {
          records: [
            {
              type: "Task",
              key: "task-mcp-created",
              title: "Created via MCP",
              status: "pending",
            },
          ],
        },
      });
      expect(res).not.toHaveProperty("error");
      const result = (res as any).result as {
        content: { text: string }[];
      };
      expect(result.content[0]!.text).toContain("1 record(s)");

      const search = await client.send("tools/call", {
        name: "search",
        arguments: { filters: { key: "task-mcp-created" } },
      });
      const searchResult = (search as any).result as {
        structuredContent: { items: any[] };
      };
      expect(searchResult.structuredContent.items).toEqual([
        expect.objectContaining({ title: "Created via MCP" }),
      ]);
    });

    it("updates an existing record", async () => {
      const res = await client.send("tools/call", {
        name: "transact",
        arguments: {
          records: [{ key: "task-mcp-created", title: "Updated via MCP" }],
        },
      });
      expect(res).not.toHaveProperty("error");

      const search = await client.send("tools/call", {
        name: "search",
        arguments: { filters: { key: "task-mcp-created" } },
      });
      const result = (search as any).result as {
        structuredContent: { items: any[] };
      };
      expect(result.structuredContent.items[0].title).toBe("Updated via MCP");
    });
  });

  describe("error handling", () => {
    it("unknown method returns error", async () => {
      const res = await client.send("bogus/method");
      expect(res).toHaveProperty("error");
      expect((res as any).error.message).toContain("not found");
    });

    it("unknown tool name returns error", async () => {
      const res = await client.send("tools/call", {
        name: "nonexistent-tool",
        arguments: {},
      });
      expect(res).toHaveProperty("error");
      expect((res as any).error.message).toContain("not found");
    });
  });
});
