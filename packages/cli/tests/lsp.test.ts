import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node";
import type {
  CompletionItem,
  DocumentDiagnosticReport,
  Hover,
  InitializeResult,
} from "vscode-languageserver-protocol";
import { tryCatch } from "@binder/utils";

import {
  run,
  setupWorkspace,
  teardownWorkspace,
  spawnBinder,
} from "./setup.ts";

const createLspClient = () => {
  const child = spawnBinder("lsp");

  const connection = createMessageConnection(
    new StreamMessageReader(child.stdout!),
    new StreamMessageWriter(child.stdin!),
  );

  connection.listen();

  const versions = new Map<string, number>();

  const initialize = async (
    workspaceDir: string,
  ): Promise<InitializeResult> => {
    const result = await connection.sendRequest("initialize", {
      processId: process.pid,
      capabilities: {
        textDocument: {
          completion: { completionItem: {} },
          hover: {},
          diagnostic: {},
        },
        workspace: { workspaceFolders: true },
      },
      workspaceFolders: [
        {
          uri: pathToFileURL(workspaceDir).toString(),
          name: "test",
        },
      ],
    });
    connection.sendNotification("initialized", {});
    await new Promise((r) => setTimeout(r, 500));
    return result as InitializeResult;
  };

  const shutdown = async () => {
    await tryCatch(async () => {
      await connection.sendRequest("shutdown");
      connection.sendNotification("exit");
    });
    connection.dispose();
    child.kill();
  };

  const openDocument = (uri: string, text: string, languageId?: string) => {
    const ext = uri.split(".").pop();
    const lang =
      languageId ?? (ext === "yaml" || ext === "yml" ? "yaml" : "markdown");

    if (versions.has(uri)) {
      const version = versions.get(uri)! + 1;
      versions.set(uri, version);
      connection.sendNotification("textDocument/didChange", {
        textDocument: { uri, version },
        contentChanges: [{ text }],
      });
    } else {
      versions.set(uri, 1);
      connection.sendNotification("textDocument/didOpen", {
        textDocument: { uri, languageId: lang, version: 1, text },
      });
    }
  };

  const saveDocument = (uri: string) => {
    connection.sendNotification("textDocument/didSave", {
      textDocument: { uri },
    });
  };

  const completion = async (
    uri: string,
    line: number,
    character: number,
  ): Promise<CompletionItem[]> => {
    const result = await connection.sendRequest("textDocument/completion", {
      textDocument: { uri },
      position: { line, character },
    });
    if (!result) return [];
    if (Array.isArray(result)) return result as CompletionItem[];
    return (result as { items: CompletionItem[] }).items ?? [];
  };

  const hover = async (
    uri: string,
    line: number,
    character: number,
  ): Promise<Hover | null> => {
    const result = await connection.sendRequest("textDocument/hover", {
      textDocument: { uri },
      position: { line, character },
    });
    return result as Hover | null;
  };

  const diagnostics = async (
    uri: string,
  ): Promise<DocumentDiagnosticReport> => {
    const result = await connection.sendRequest("textDocument/diagnostic", {
      textDocument: { uri },
    });
    return result as DocumentDiagnosticReport;
  };

  return {
    connection,
    process: child,
    initialize,
    shutdown,
    openDocument,
    saveDocument,
    completion,
    hover,
    diagnostics,
  };
};

describe("LSP", () => {
  let dir: string;
  let client: ReturnType<typeof createLspClient>;
  let initResult: InitializeResult;

  beforeAll(async () => {
    dir = await setupWorkspace({ docs: true });
    client = createLspClient();
    initResult = await client.initialize(dir);
  }, 15_000);

  afterAll(async () => {
    await client.shutdown();
    await teardownWorkspace(dir);
  });

  const fileUri = (relPath: string) =>
    pathToFileURL(join(dir, "docs", relPath)).toString();

  const readDoc = (relPath: string) =>
    readFile(join(dir, "docs", relPath), "utf-8");

  const getHoverContent = (result: Hover): string => {
    if (typeof result.contents === "string") return result.contents;
    if ("value" in result.contents) return result.contents.value;
    return "";
  };

  // --- Initialize ---

  it("server responds with capabilities", () => {
    expect(initResult.capabilities).toBeDefined();
    expect(initResult.capabilities.textDocumentSync).toBeDefined();
    expect(initResult.capabilities.completionProvider).toBeDefined();
    expect(initResult.capabilities.hoverProvider).toBe(true);
    expect(initResult.capabilities.definitionProvider).toBe(true);
    expect(initResult.capabilities.codeActionProvider).toBeDefined();
  });

  // --- Hover ---

  it("hover on YAML field key returns field info", async () => {
    const uri = fileUri("tasks-yaml/task-implement-user-auth.yaml");
    const text = await readDoc("tasks-yaml/task-implement-user-auth.yaml");
    client.openDocument(uri, text);

    const lines = text.split("\n");
    const statusLine = lines.findIndex((l) => l.startsWith("status:"));
    expect(statusLine).toBeGreaterThanOrEqual(0);

    const result = await client.hover(uri, statusLine, 2);
    expect(result).not.toBeNull();
    expect(getHoverContent(result!)).toContain("option");
  });

  // --- Completion ---

  it("completion in YAML suggests missing field keys", async () => {
    // Position cursor on an existing field key to trigger field-key completion.
    // The YAML file has: key, title, status, priority, description.
    // Completion should suggest other Task type fields not in the file.
    const uri = fileUri("tasks-yaml/task-implement-user-auth.yaml");
    const text = await readDoc("tasks-yaml/task-implement-user-auth.yaml");
    client.openDocument(uri, text);

    // Cursor on "key:" line (col 0) triggers field-key completion
    const items = await client.completion(uri, 0, 0);

    const labels = items.map((i) => i.label);
    // Should suggest fields from the Task type that aren't in this file
    expect(labels.length).toBeGreaterThan(0);
    expect(labels).toContain("tags");
  });

  it("completion for option field suggests values", async () => {
    // Use a different file to avoid version conflicts
    const uri = fileUri("tasks-yaml/task-implement-auth.yaml");
    const text = await readDoc("tasks-yaml/task-implement-auth.yaml");
    client.openDocument(uri, text);

    const lines = text.split("\n");
    const statusLine = lines.findIndex((l) => l.startsWith("status:"));
    expect(statusLine).toBeGreaterThanOrEqual(0);

    const items = await client.completion(
      uri,
      statusLine,
      lines[statusLine]!.length,
    );

    const labels = items.map((i) => i.label);
    expect(labels).toContain("pending");
    expect(labels).toContain("active");
  });

  // --- didChange stale state ---

  it("completion reflects didChange content", async () => {
    const relPath = "tasks-yaml/task-create-api.yaml";
    const uri = fileUri(relPath);
    const original = await readDoc(relPath);

    client.openDocument(uri, original);

    const itemsBefore = await client.completion(uri, 0, 0);
    const labelsBefore = itemsBefore.map((i) => i.label);
    expect(labelsBefore).not.toContain("priority");

    const withoutPriority = original
      .split("\n")
      .filter((l) => !l.startsWith("priority:"))
      .join("\n");
    client.openDocument(uri, withoutPriority);

    const itemsAfter = await client.completion(uri, 0, 0);
    const labelsAfter = itemsAfter.map((i) => i.label);
    expect(labelsAfter).toContain("priority");
  });

  // --- Diagnostics ---

  it("diagnostics on valid file returns no errors", async () => {
    const uri = fileUri("tasks-yaml/task-create-api.yaml");
    const text = await readDoc("tasks-yaml/task-create-api.yaml");
    client.openDocument(uri, text);

    const report = await client.diagnostics(uri);
    expect(report.kind).toBe("full");
    if (report.kind === "full") {
      const errors = report.items.filter((d) => d.severity === 1);
      expect(errors).toEqual([]);
    }
  });

  it("diagnostics on invalid field value reports error", async () => {
    // Use the same file but update content to have an invalid value
    const uri = fileUri("tasks-yaml/task-create-api.yaml");
    const text = await readDoc("tasks-yaml/task-create-api.yaml");
    const invalid = text.replace(/status: \w+/, "status: bogus-status");
    client.openDocument(uri, invalid);

    const report = await client.diagnostics(uri);
    expect(report.kind).toBe("full");
    if (report.kind === "full") {
      const errors = report.items.filter((d) => d.severity === 1);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.message).toContain("status");
    }
  });

  // --- Sync on save ---

  it("save triggers sync and updates DB", async () => {
    const relPath = "tasks-yaml/task-implement-auth.yaml";
    const uri = fileUri(relPath);
    const text = await readDoc(relPath);
    const edited = text.replace(/title: .+/, "title: LSP-edited title");

    // Write edited content to disk (save handler reads from disk)
    await writeFile(join(dir, "docs", relPath), edited);
    client.openDocument(uri, edited);
    client.saveDocument(uri);

    // Wait for sync
    await new Promise((r) => setTimeout(r, 1000));

    const result = await run(
      ["read", "task-implement-auth", "--format", "json"],
      { cwd: dir },
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      title: "LSP-edited title",
    });
  });
});
