import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { Database as BunDatabase } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core";
import {
  createError,
  type Result,
  ok,
  isErr,
  tryCatch,
  serializeErrorData,
} from "@binder/utils";
import * as coreSchema from "./schema";

type DbSchema = Record<string, unknown>;

type CustomMigrationResult = Result<void> | void;

export type DrizzleDb<TSchema extends DbSchema = typeof coreSchema> =
  BunSQLiteDatabase<TSchema> & {
    $client: BunDatabase;
  };

export type Database = DrizzleDb<typeof coreSchema>;
export type DbTransaction = SQLiteTransaction<any, any, any, any>;

export type OpenDbMigrationContext<TSchema extends DbSchema> = {
  db: DrizzleDb<TSchema>;
  sqlite: BunDatabase;
  defaultMigrationsFolder: string;
  migrateDefault: (migrationsFolder?: string) => Result<void>;
};

export type OpenDbMigrationOptions<TSchema extends DbSchema> = {
  folder?: string;
  run?: (context: OpenDbMigrationContext<TSchema>) => CustomMigrationResult;
};

type FileDbOptions<TSchema extends DbSchema> = {
  path: string;
  migrate: boolean | OpenDbMigrationOptions<TSchema>;
  schema?: TSchema;
};

type MemoryDbOptions<TSchema extends DbSchema> = {
  memory: true;
  migrate?: boolean | OpenDbMigrationOptions<TSchema>;
  schema?: TSchema;
};

export type OpenDbOptions<TSchema extends DbSchema = typeof coreSchema> =
  | FileDbOptions<TSchema>
  | MemoryDbOptions<TSchema>;

const applyBalancedSqlitePragmas = (sqlite: BunDatabase): Result<void> => {
  const pragmaResult = tryCatch(
    () => {
      sqlite.exec(`
        -- Integrity and lock behavior
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;

        -- Balanced durability and concurrency for local-first workloads
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        -- Modest memory tuning
        -- cache_size default is commonly 2000 pages; set ~16 MiB explicitly
        PRAGMA cache_size = -16384;
        -- mmap_size default is 0 (disabled); allow up to 64 MiB
        PRAGMA mmap_size = 67108864;
      `);
    },
    (error) =>
      createError("db-config-failed", "Failed to apply SQLite configuration", {
        error: serializeErrorData(error),
      }),
  );

  if (isErr(pragmaResult)) return pragmaResult;
  return ok(undefined);
};

export const openDb = <TSchema extends DbSchema = typeof coreSchema>(
  options: OpenDbOptions<TSchema>,
): Result<DrizzleDb<TSchema>> => {
  const isMemory = "memory" in options && options.memory;
  const dbPath = isMemory
    ? ":memory:"
    : (options as FileDbOptions<TSchema>).path;
  const migrateOption = options.migrate;
  const shouldMigrate =
    migrateOption === undefined ? isMemory : migrateOption !== false;

  const sqliteResult = tryCatch(
    () => new BunDatabase(dbPath),
    (error) =>
      createError("db-open-failed", `Failed to open database at ${dbPath}`, {
        error,
      }),
  );

  if (isErr(sqliteResult)) return sqliteResult;

  const sqlite = sqliteResult.data;
  const pragmaResult = applyBalancedSqlitePragmas(sqlite);
  if (isErr(pragmaResult)) {
    sqlite.close();
    return pragmaResult;
  }

  const dbSchema = (options.schema ?? coreSchema) as TSchema;
  const db = drizzle<TSchema>(sqlite, {
    schema: dbSchema,
  }) as DrizzleDb<TSchema>;

  if (shouldMigrate) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const defaultMigrationsFolder = join(__dirname, "migrations");

    const customMigrateOption =
      typeof migrateOption === "object" ? migrateOption : undefined;

    const migrateDefault = (
      migrationsFolder = customMigrateOption?.folder ?? defaultMigrationsFolder,
    ): Result<void> => {
      const migrationResult = tryCatch(
        () => migrate(db, { migrationsFolder }),
        (error) =>
          createError("db-migration-failed", "Failed to run migrations", {
            error: serializeErrorData(error),
          }),
      );

      if (isErr(migrationResult)) return migrationResult;
      return ok(undefined);
    };

    const customMigrationRunner = customMigrateOption?.run;

    if (customMigrationRunner) {
      const customRunnerResult = tryCatch(
        () =>
          customMigrationRunner({
            db,
            sqlite,
            defaultMigrationsFolder,
            migrateDefault,
          }),
        (error) =>
          createError(
            "db-migration-failed",
            "Failed to run custom migration logic",
            {
              error: serializeErrorData(error),
            },
          ),
      );

      if (isErr(customRunnerResult)) {
        sqlite.close();
        return customRunnerResult;
      }

      const customMigrationResult = customRunnerResult.data;
      if (customMigrationResult && isErr(customMigrationResult)) {
        sqlite.close();
        return customMigrationResult;
      }
    } else {
      const migrationResult = migrateDefault();
      if (isErr(migrationResult)) {
        sqlite.close();
        return migrationResult;
      }
    }
  }

  return ok(db);
};
