import { spawn } from "node:child_process";
import { isErr, tryCatch } from "@binder/utils";
import { isInteractive } from "./stdin.ts";

const findPager = (): string[] | undefined => {
  const pager = process.env.PAGER;
  if (pager !== undefined)
    return pager.length > 0 ? pager.split(/\s+/) : undefined;
  return ["less", "-R"];
};

const captureOutput = (fn: () => void): string => {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  (process.stdout.write as unknown) = (data: string | Uint8Array): boolean => {
    chunks.push(
      typeof data === "string" ? data : new TextDecoder().decode(data),
    );
    return true;
  };

  // eslint-disable-next-line no-restricted-syntax -- try/finally for cleanup, not error handling
  try {
    fn();
  } finally {
    process.stdout.write = originalWrite;
  }

  return chunks.join("");
};

const spawnPager = async (cmd: string[], output: string): Promise<boolean> => {
  const [bin, ...args] = cmd;
  const result = await tryCatch(async () => {
    const proc = spawn(bin!, args, {
      stdio: ["pipe", "inherit", "inherit"],
    });
    proc.stdin!.write(output);
    proc.stdin!.end();
    await new Promise<void>((resolve, reject) => {
      proc.on("close", () => resolve());
      proc.on("error", reject);
    });
  });
  return !isErr(result);
};

/**
 * Pipe output through a pager (like `less`) when stdout is a TTY.
 * Captures all output from the callback and sends it to the pager.
 * Falls back to direct output if no pager is available or stdout is not a TTY.
 */
export const withPager = async (fn: () => void): Promise<void> => {
  const pagerCmd = isInteractive() ? findPager() : undefined;
  if (!pagerCmd) {
    fn();
    return;
  }

  const output = captureOutput(fn);
  if (output.length === 0) return;

  const paged = await spawnPager(pagerCmd, output);
  if (!paged) process.stdout.write(output);
};
