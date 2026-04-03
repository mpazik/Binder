import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { getGlobalStatePath } from "../config.ts";
import { isDevMode } from "../environment.ts";
import { textBold, textWarn } from "../cli/ui.ts";

type UpdateCache = {
  lastCheck: string;
  latestVersion: string;
};

const CACHE_FILE = "update-check.json";
const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 5000;
const DEFAULT_REGISTRY_URL = "https://registry.npmjs.org/@binder.do/cli/latest";

const getCachePath = (): string => join(getGlobalStatePath(), CACHE_FILE);

const readCache = (): Promise<UpdateCache | null> =>
  readFile(getCachePath(), "utf-8")
    .then((raw) => JSON.parse(raw) as UpdateCache)
    .catch(() => null);

const writeCache = async (cache: UpdateCache): Promise<void> => {
  const path = getCachePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cache));
};

const fetchLatestVersion = (): Promise<string | null> => {
  const url = process.env.BINDER_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as { version?: string };
      return data.version ?? null;
    })
    .catch(() => null);
};

const isNewer = (latest: string, current: string): boolean => {
  const a = latest.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
};

const isStale = (cache: UpdateCache): boolean =>
  Date.now() - new Date(cache.lastCheck).getTime() > STALE_MS;

const detectInstallCommand = (): string => {
  const argv0 = process.argv[0] ?? "";
  if (argv0.includes("pnpm")) return "pnpm add -g @binder.do/cli";
  if (argv0.includes("yarn")) return "yarn global add @binder.do/cli";
  if (argv0.includes("bun")) return "bun add -g @binder.do/cli";
  return "npm install -g @binder.do/cli";
};

const shouldSkip = (): boolean => {
  if (process.env.BINDER_SKIP_UPDATE_CHECK === "1") return true;

  // When BINDER_REGISTRY_URL is set, always run (enables E2E testing).
  if (process.env.BINDER_REGISTRY_URL) return false;

  if (isDevMode()) return true;
  if (!process.stderr.isTTY) return true;
  if (process.argv.includes("--quiet") || process.argv.includes("-q"))
    return true;

  return false;
};

/**
 * Check for a newer version of Binder CLI.
 *
 * Reads a cached result first. If a cached newer version exists, prints a
 * one-line notification to stderr. If the cache is stale (>24h), fires a
 * non-blocking async fetch to the npm registry and writes the result back.
 *
 * Notifications appear on the *next* run, not the current one.
 */
export const checkForUpdate = async (currentVersion: string): Promise<void> => {
  if (shouldSkip()) return;

  const cache = await readCache();

  if (cache && isNewer(cache.latestVersion, currentVersion)) {
    const cmd = detectInstallCommand();
    process.stderr.write(
      `${textWarn(`Update available: ${currentVersion} \u2192 ${cache.latestVersion}.`)} Run: ${textBold(cmd)}\n`,
    );
  }

  if (!cache || isStale(cache)) {
    fetchLatestVersion()
      .then(async (version) => {
        if (version) {
          await writeCache({
            lastCheck: new Date().toISOString(),
            latestVersion: version,
          });
        }
      })
      .catch(() => {});
  }
};
