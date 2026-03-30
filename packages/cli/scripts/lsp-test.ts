#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { type LspClient, createLspClient } from "../tests/lsp-client.ts";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const CLI_ENTRY = resolve(REPO_ROOT, "packages/cli/src/index.ts");

type Action =
  | "hover"
  | "completion"
  | "diagnostics"
  | "definition"
  | "code-actions"
  | "inlay-hints"
  | "semantic-tokens"
  | "save";

const ACTIONS: Action[] = [
  "hover",
  "completion",
  "diagnostics",
  "definition",
  "code-actions",
  "inlay-hints",
  "semantic-tokens",
  "save",
];

const POSITION_ACTIONS: Action[] = [
  "hover",
  "completion",
  "definition",
  "code-actions",
];

const needsPosition = (action: Action): boolean =>
  POSITION_ACTIONS.includes(action);

type Command = {
  file: string;
  action: Action;
  position?: { line: number; character: number };
};

type RunLspTestOptions = {
  cwd?: string;
  commands: Command[];
};

const die = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const getCommand = (): string[] => {
  const env = process.env.BINDER_CLI;
  if (!env) return ["bun", "run", CLI_ENTRY];
  const parts = env.trim().split(/\s+/);
  if (parts.length === 1 && parts[0] === "binder") {
    die(
      "BINDER_CLI=binder would run the globally installed binary. Use an explicit path or unset BINDER_CLI.",
    );
  }
  return parts;
};

const parsePosition = (pos: string): { line: number; character: number } => {
  const [lineStr, colStr] = pos.split(":");
  const line = parseInt(lineStr!, 10);
  const col = parseInt(colStr!, 10);
  if (isNaN(line) || isNaN(col)) {
    die(`Invalid position "${pos}". Expected line:col (1-based).`);
  }
  return { line: line - 1, character: col - 1 };
};

const executeAction = async (
  client: LspClient,
  uri: string,
  action: Action,
  position?: { line: number; character: number },
  lineCount?: number,
): Promise<unknown> => {
  const line = position?.line ?? 0;
  const char = position?.character ?? 0;

  switch (action) {
    case "hover":
      return client.hover(uri, line, char);
    case "completion":
      return client.completion(uri, line, char);
    case "diagnostics":
      return client.diagnostics(uri);
    case "definition":
      return client.definition(uri, line, char);
    case "code-actions":
      return client.codeActions(uri, line, char, line, char);
    case "inlay-hints":
      return client.inlayHints(uri, 0, 0, lineCount ?? 1000, 0);
    case "semantic-tokens":
      return client.semanticTokens(uri);
    case "save": {
      client.saveDocument(uri);
      // Save triggers an async sync in the LSP server. Wait for it to
      // settle so the caller can observe the side-effects (e.g. binder read).
      await new Promise((r) => setTimeout(r, 2000));
      return { ok: true };
    }
  }
};

/**
 * Spawn an LSP server, execute a sequence of commands, and return results.
 * Opens each file once and reuses it across commands. Positions are 0-based (LSP convention).
 */
export const runLspTest = async (
  options: RunLspTestOptions,
): Promise<unknown[]> => {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const [bin, ...args] = getCommand();

  const child = spawn(bin!, [...args, "lsp"], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stderr?.pipe(process.stderr);

  const client = createLspClient(child);
  await client.initialize(cwd);

  const opened = new Map<string, { uri: string; lineCount: number }>();

  const ensureOpen = async (
    file: string,
  ): Promise<{ uri: string; lineCount: number }> => {
    const absPath = resolve(cwd, file);
    if (opened.has(absPath)) return opened.get(absPath)!;
    const text = await readFile(absPath, "utf-8");
    const uri = pathToFileURL(absPath).toString();
    client.openDocument(uri, text);
    const entry = { uri, lineCount: text.split("\n").length };
    opened.set(absPath, entry);
    return entry;
  };

  const results: unknown[] = [];

  for (const command of options.commands) {
    const { uri, lineCount } = await ensureOpen(command.file);
    results.push(
      await executeAction(
        client,
        uri,
        command.action,
        command.position,
        lineCount,
      ),
    );
  }

  await client.shutdown();
  return results;
};

const readStdinLines = (): Promise<string[]> =>
  new Promise((resolve) => {
    const lines: string[] = [];
    const rl = createInterface({ input: process.stdin });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (trimmed) lines.push(trimmed);
    });
    rl.on("close", () => resolve(lines));
  });

const parseTsvLine = (line: string): Command => {
  const parts = line.split("\t");
  const file = parts[0]!;
  const action = parts[1] as Action;
  if (!ACTIONS.includes(action)) {
    die(`Unknown action "${action}". Expected one of: ${ACTIONS.join(", ")}`);
  }
  const position = parts[2] ? parsePosition(parts[2]) : undefined;
  if (needsPosition(action) && !position) {
    die(`Action "${action}" requires a position (line:col).`);
  }
  return { file, action, position };
};

const USAGE = `Usage:
  bun packages/cli/scripts/lsp-test.ts <file> <action> [line:col] [--cwd=path]
  cat batch.tsv | bun packages/cli/scripts/lsp-test.ts [--cwd=path]

Actions: ${ACTIONS.join(", ")}

Positions are 1-based. Actions that require a position: ${POSITION_ACTIONS.join(", ")}

Environment:
  BINDER_CLI   Override the CLI command used to spawn the LSP server.
               By default the script runs from source (bun run src/index.ts),
               which uses dev-mode paths (.binder-dev/). To test against a
               production workspace (.binder/), point to the built binary:

                 BINDER_CLI="node packages/cli/dist/index.js" bun packages/cli/scripts/lsp-test.ts ...`;

if (import.meta.main) {
  const argv = process.argv.slice(2);
  let cwd: string | undefined;
  const positionals: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith("--cwd=")) {
      cwd = arg.slice(6);
    } else if (arg === "--help" || arg === "-h") {
      console.info(USAGE);
      process.exit(0);
    } else {
      positionals.push(arg);
    }
  }

  let commands: Command[];

  if (positionals.length > 0) {
    const [file, action, pos] = positionals;
    if (!file || !action) {
      console.error(USAGE);
      process.exit(1);
    }
    if (!ACTIONS.includes(action as Action)) {
      console.error(
        `Unknown action "${action}". Expected one of: ${ACTIONS.join(", ")}`,
      );
      process.exit(1);
    }
    const position = pos ? parsePosition(pos) : undefined;
    if (needsPosition(action as Action) && !position) {
      console.error(`Action "${action}" requires a position (line:col).`);
      process.exit(1);
    }
    commands = [{ file, action: action as Action, position }];
  } else {
    if (process.stdin.isTTY) {
      console.error(USAGE);
      process.exit(1);
    }
    const lines = await readStdinLines();
    if (lines.length === 0) {
      console.error("No input lines received on stdin.");
      process.exit(1);
    }
    commands = lines.map(parseTsvLine);
  }

  const results = await runLspTest({ cwd, commands });

  if (positionals.length > 0) {
    console.info(JSON.stringify(results[0], null, 2));
  } else {
    for (const result of results) {
      console.info(JSON.stringify(result));
    }
  }
}
