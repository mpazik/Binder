import { type ChildProcess } from "node:child_process";

export const waitForServer = async (
  server: ChildProcess,
  base: string,
): Promise<void> => {
  let output = "";
  let spawnError: Error | undefined;
  server.stdout?.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr?.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.on("error", (error) => {
    spawnError = error;
  });
  for (let i = 0; i < 40; i++) {
    if (spawnError || server.exitCode !== null || server.signalCode !== null)
      break;
    const ok = await fetch(`${base}/api/records`, {
      signal: AbortSignal.timeout(500),
    })
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) return;
    await Bun.sleep(150);
  }
  // eslint-disable-next-line no-restricted-syntax
  throw new Error(
    `HTTP server did not start (exit ${server.exitCode}, signal ${server.signalCode}): ${spawnError?.message ?? ""}\n${output}`,
  );
};

export const stopServer = async (
  server: ChildProcess | undefined,
): Promise<void> => {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    server.once("close", () => resolve());
    server.kill();
  });
};
