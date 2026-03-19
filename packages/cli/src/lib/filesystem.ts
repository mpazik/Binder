import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  truncate,
  writeFile,
  access,
  open,
} from "fs/promises";
import { createReadStream, statSync } from "fs";
import { isErr, type Result, type ResultAsync, tryCatch } from "@binder/utils";

export type FileStat = {
  size: number;
  mtime: number;
};

export type DirEntry = {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
};

export type FileSystem = {
  exists: (path: string) => Promise<boolean>;
  readFile: (path: string) => ResultAsync<string>;
  readFileStream: (path: string) => AsyncIterable<Uint8Array>;
  writeFile: (path: string, content: string) => ResultAsync<void>;
  appendFile: (path: string, content: string) => ResultAsync<void>;
  stat: (path: string) => Result<FileStat>;
  slice: (path: string, start: number, end: number) => ResultAsync<ArrayBuffer>;
  truncate: (path: string, size: number) => ResultAsync<void>;
  mkdir: (path: string, options?: { recursive?: boolean }) => ResultAsync<void>;
  rm: (
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ) => ResultAsync<void>;
  readdir: (path: string) => ResultAsync<DirEntry[]>;
  renameFile: (oldPath: string, newPath: string) => ResultAsync<void>;
  scan: (path: string) => AsyncGenerator<string, void, unknown>;
};

export const createRealFileSystem = (): FileSystem => {
  return {
    exists: async (path: string) => {
      // eslint-disable-next-line no-restricted-syntax
      try {
        await access(path);
        return true;
      } catch {
        return false;
      }
    },

    readFile: (path: string) => tryCatch(() => readFile(path, "utf-8")),

    readFileStream: (path: string) => {
      const stream = createReadStream(path);
      return (async function* () {
        for await (const chunk of stream) {
          yield chunk instanceof Buffer
            ? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
            : (chunk as Uint8Array);
        }
      })();
    },

    writeFile: (path: string, content: string) =>
      tryCatch(() => writeFile(path, content, "utf-8")),

    appendFile: async (path: string, content: string) =>
      tryCatch(async () => {
        const existingContent = await readFile(path, "utf-8").catch(() => "");
        await writeFile(path, existingContent + content, "utf-8");
      }),

    stat: (path: string) =>
      tryCatch(() => {
        const stats = statSync(path);
        return {
          size: stats.size,
          mtime: stats.mtimeMs,
        };
      }),

    slice: async (path: string, start: number, end: number) =>
      tryCatch(async () => {
        const length = end - start;
        const buffer = Buffer.alloc(length);
        const fh = await open(path, "r");
        const result = await fh
          .read(buffer, 0, length, start)
          .finally(() => fh.close());
        void result;
        return buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer;
      }),

    truncate: async (path: string, size: number) =>
      tryCatch(() => truncate(path, size)),

    mkdir: (path: string, options?: { recursive?: boolean }) =>
      tryCatch(async () => {
        await mkdir(path, options);
      }),

    rm: (path: string, options?: { recursive?: boolean; force?: boolean }) =>
      tryCatch(() => rm(path, options)),

    readdir: async (path: string) =>
      tryCatch(async () => {
        const entries = await readdir(path, { withFileTypes: true });
        return entries.map((entry) => ({
          name: entry.name,
          isFile: entry.isFile(),
          isDirectory: entry.isDirectory(),
        }));
      }),

    renameFile: (oldPath: string, newPath: string) =>
      tryCatch(() => rename(oldPath, newPath)),

    scan: async function* (
      startPath: string,
    ): AsyncGenerator<string, void, unknown> {
      async function* scanDirectory(
        dirPath: string,
      ): AsyncGenerator<string, void, unknown> {
        const entriesResult = await tryCatch(async () => {
          const entries = await readdir(dirPath, { withFileTypes: true });
          return entries.map((entry) => ({
            name: entry.name,
            isFile: entry.isFile(),
            isDirectory: entry.isDirectory(),
          }));
        });
        if (isErr(entriesResult)) return;

        for (const entry of entriesResult.data) {
          const filePath = `${dirPath}/${entry.name}`;

          if (entry.isDirectory) {
            yield* scanDirectory(filePath);
          } else if (entry.isFile) {
            yield filePath;
          }
        }
      }

      yield* scanDirectory(startPath);
    },
  };
};
