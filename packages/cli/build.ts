#!/usr/bin/env bun
/* eslint-disable no-console */
import { readFileSync, cpSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import type { BunPlugin } from "bun";

const isProd = process.argv.includes("--prod");

const packageJson = JSON.parse(
  readFileSync(join(import.meta.dir, "package.json"), "utf-8"),
);
const baseVersion = packageJson.version;

const version = isProd
  ? baseVersion
  : `${baseVersion}-dev.${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "")}`;

console.log(
  `Building Binder CLI v${version}${isProd ? " (production)" : " (development)"}...`,
);

/**
 * Build plugin that swaps *.bun.ts imports for *.node.ts counterparts.
 *
 * Convention: when a module needs different implementations for Bun and Node,
 * create two files side by side -- `foo.bun.ts` (used during dev/test under
 * Bun) and `foo.node.ts` (bundled into the production Node build). Source
 * code always imports the `.bun.ts` variant; this plugin rewires it at
 * build time.
 *
 * See docs/contributing/node-compatibility.md for details.
 */
const nodeCompatPlugin: BunPlugin = {
  name: "node-compat",
  setup(build) {
    build.onResolve({ filter: /\.bun(\.ts)?$/ }, (args) => {
      const nodeVersion = args.path.replace(/\.bun(\.ts)?$/, ".node.ts");
      return {
        path: resolve(dirname(args.importer), nodeVersion),
      };
    });
  },
};

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "node",
  packages: "bundle",
  external: ["better-sqlite3"],
  define: {
    __BINDER_VERSION__: JSON.stringify(version),
  },
  plugins: [nodeCompatPlugin],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`✓ Built successfully: dist/index.js`);

const { mergeMigrationFolders } = await import("./src/db/merge-migrations.ts");

const dbMigrationsSource = join(import.meta.dir, "../db/src/migrations");
const cliMigrationsSource = join(import.meta.dir, "src/db/migrations");
const migrationsTarget = join(import.meta.dir, "dist/migrations");

mergeMigrationFolders(
  [dbMigrationsSource, cliMigrationsSource],
  migrationsTarget,
);

console.log(`✓ Merged migrations to dist/migrations`);

const blueprintsSource = join(import.meta.dir, "data/blueprints");
const blueprintsTarget = join(import.meta.dir, "dist/blueprints");

mkdirSync(blueprintsTarget, { recursive: true });
cpSync(blueprintsSource, blueprintsTarget, { recursive: true });

console.log(`✓ Copied blueprints to dist/blueprints`);
