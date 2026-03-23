#!/usr/bin/env bun
/**
 * Release script for @binder.do/cli
 *
 * Usage: bun scripts/release.ts
 *
 * Steps:
 * 1. Check for uncommitted changes
 * 2. Gather commits since last release, detect a bump type
 * 3. Show commits and suggest a version
 * 4. Ask for confirmation
 * 5. Run checks
 * 6. Bump version, commit, tag
 * 7. Publish to npm
 * 8. Push and create GitHub release
 */
/* eslint-disable no-console */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as readline from "readline";
import { $ } from "bun";

const CLI_PKG_PATH = join(import.meta.dir, "../packages/cli/package.json");

// --- Helpers ---

function readCliVersion(): string {
  const pkg = JSON.parse(readFileSync(CLI_PKG_PATH, "utf-8"));
  return pkg.version;
}

function bumpVersion(
  current: string,
  bump: "major" | "minor" | "patch",
): string {
  const [major, minor, patch] = current.split(".").map(Number);
  switch (bump) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

function writeCliVersion(version: string): void {
  const pkg = JSON.parse(readFileSync(CLI_PKG_PATH, "utf-8"));
  pkg.version = version;
  writeFileSync(CLI_PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

interface Commit {
  hash: string;
  message: string;
  prefix: string;
  scope: string | null;
  description: string;
}

function parseCommit(line: string): Commit {
  const hash = line.slice(0, 7);
  const message = line.slice(8);

  const match = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
  if (match) {
    return {
      hash,
      message,
      prefix: match[1],
      scope: match[2] || null,
      description: match[3],
    };
  }
  return { hash, message, prefix: "other", scope: null, description: message };
}

const FEATURE_PREFIXES = new Set(["feat"]);
const USER_FACING_PREFIXES = new Set(["feat", "fix", "tweak", "perf"]);

type GroupLabel = string;
const GROUP_ORDER: [string, GroupLabel][] = [
  ["feat", "Features"],
  ["fix", "Fixes"],
  ["tweak", "Tweaks"],
  ["perf", "Performance"],
];

function groupCommits(commits: Commit[]): Map<GroupLabel, Commit[]> {
  const groups = new Map<GroupLabel, Commit[]>();
  for (const commit of commits) {
    const entry = GROUP_ORDER.find(([prefix]) => prefix === commit.prefix);
    const label = entry ? entry[1] : "Other";
    const list = groups.get(label) || [];
    list.push(commit);
    groups.set(label, list);
  }
  return groups;
}

function formatReleaseNotes(groups: Map<GroupLabel, Commit[]>): string {
  const sections: string[] = [];
  for (const [, label] of GROUP_ORDER) {
    const commits = groups.get(label);
    if (!commits?.length) continue;
    sections.push(`## ${label}\n`);
    for (const c of commits) {
      const scope = c.scope ? `**${c.scope}**: ` : "";
      sections.push(`- ${scope}${c.description} (${c.hash})`);
    }
    sections.push("");
  }
  return sections.join("\n").trim();
}

// --- Main ---

async function main() {
  console.log("\n=== Binder Release ===\n");

  // 1. Check for uncommitted changes
  const status = (await $`git status --porcelain`.text()).trim();
  if (status) {
    console.error("Uncommitted changes detected. Commit or stash first.\n");
    console.error(status);
    process.exit(1);
  }

  // 2. Find last tag and gather commits
  const lastTag = (
    await $`git describe --tags --abbrev=0 2>/dev/null || echo ""`.text()
  ).trim();
  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
  const logOutput = (
    await $`git log ${range} --oneline --no-decorate`.text()
  ).trim();

  if (!logOutput) {
    console.log("No commits since last release. Nothing to do.");
    process.exit(0);
  }

  const commits = logOutput.split("\n").map(parseCommit);
  const groups = groupCommits(commits);

  // 3. Detect bump type
  const hasFeature = commits.some((c) => FEATURE_PREFIXES.has(c.prefix));
  const hasUserFacing = commits.some((c) => USER_FACING_PREFIXES.has(c.prefix));

  const suggestedBump = hasFeature ? "minor" : "patch";
  const currentVersion = readCliVersion();
  const suggestedVersion = bumpVersion(currentVersion, suggestedBump);

  // 4. Print commits
  console.log(`Commits since ${lastTag || "beginning"} (${commits.length}):\n`);
  const notes = formatReleaseNotes(groups);
  console.log(notes);
  console.log();

  // 5. Ask for confirmation
  if (!hasUserFacing) {
    console.log("No user-facing changes detected.");
    const answer = await prompt("Continue with release anyway? [y/N] ");
    if (answer.toLowerCase() !== "y") {
      console.log("Aborted.");
      process.exit(0);
    }
    console.log();
  }

  const versionInput = await prompt(`Version [${suggestedVersion}]: `);
  const newVersion = versionInput || suggestedVersion;

  if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error(`Invalid version: ${newVersion}`);
    process.exit(1);
  }

  const confirm = await prompt(`Release v${newVersion}? [Y/n] `);
  if (confirm.toLowerCase() === "n") {
    console.log("Aborted.");
    process.exit(0);
  }

  // 6. Run checks
  console.log("\nRunning checks...");
  await $`bun run check:verify`.throws(true);

  // 7. Bump version, commit, tag
  console.log(`\nBumping version: ${currentVersion} -> ${newVersion}`);
  writeCliVersion(newVersion);

  await $`git add packages/cli/package.json`;
  await $`git commit -m ${"release: v" + newVersion}`;
  await $`git tag ${"v" + newVersion}`;

  // 8. Publish to npm
  console.log("\nPublishing to npm...");
  await $`cd packages/cli && npm publish`.throws(true);

  // 9. Push
  console.log("\nPushing to remote...");
  const branch = (await $`git branch --show-current`.text()).trim();
  await $`git push origin ${branch}`;
  await $`git push origin ${"v" + newVersion}`;

  // 10. Create GitHub release
  console.log("\nCreating GitHub release...");
  if (hasUserFacing) {
    await $`gh release create ${"v" + newVersion} --title ${"v" + newVersion} --notes ${notes}`;
  } else {
    await $`gh release create ${"v" + newVersion} --title ${"v" + newVersion} --generate-notes`;
  }

  console.log(`\n=== Released v${newVersion} ===`);
}

await main();
