import * as YAML from "yaml";
import { beforeEach, describe, expect, it } from "bun:test";
import { throwIfError } from "@binder/utils";
import "@binder/utils/tests";
import { mockTransactionInitInput } from "@binder/db/mocks";
import type { EntityType, NamespaceEditable } from "@binder/db";
import { createMockRuntimeContextWithDb } from "../runtime.mock.ts";
import type { RuntimeContextWithDb } from "../runtime.ts";
import { createUi, type Ui } from "../cli/ui.ts";
import type { SerializeItemFormat } from "../utils/serialize.ts";
import { schemaHandler } from "./schema.ts";

describe("schemaHandler", () => {
  let ctx: RuntimeContextWithDb;

  beforeEach(async () => {
    ctx = await createMockRuntimeContextWithDb();
    throwIfError(await ctx.kg.update(mockTransactionInitInput));
  });

  /** Create a UI that captures output, mirroring real quiet-mode behaviour. */
  const createCapturingUi = (quiet: boolean): { ui: Ui; output: string[] } => {
    const output: string[] = [];
    const realUi = createUi({ quiet });

    return {
      output,
      ui: {
        ...realUi,
        // Intercept stdout writes — the external I/O boundary
        println: quiet
          ? realUi.println // noop in quiet mode
          : (...msg: string[]) => output.push(msg.join(" ")),
        print: quiet
          ? realUi.print
          : (...msg: string[]) => output.push(msg.join(" ")),
        printData: (data: unknown, format?: string) => {
          output.push(
            format === "json"
              ? JSON.stringify(data, null, 2)
              : format === "yaml"
                ? YAML.stringify(data)
                : String(data),
          );
        },
      },
    };
  };

  const run = async (args: {
    namespace?: NamespaceEditable;
    types?: EntityType[];
    format?: SerializeItemFormat;
  }) => {
    const { ui, output } = createCapturingUi(!!args.format);

    const result = await schemaHandler({
      ...ctx,
      ui,
      args: { namespace: args.namespace ?? "record", ...args },
    });

    return { result, output: output.join("") };
  };

  describe("--format json", () => {
    it("outputs valid JSON with fields and types", async () => {
      const { result, output } = await run({ format: "json" });

      expect(result).toBeOk();
      const parsed = JSON.parse(output);
      expect(Object.keys(parsed.fields).length).toBeGreaterThan(0);
      expect(Object.keys(parsed.types).length).toBeGreaterThan(0);
    });

    it("filters to specified types", async () => {
      const { result, output } = await run({
        format: "json",
        types: ["Task" as EntityType],
      });

      expect(result).toBeOk();
      const parsed = JSON.parse(output);
      expect(Object.keys(parsed.types)).toEqual(["Task"]);
      expect(Object.keys(parsed.fields).length).toBeGreaterThan(0);
    });
  });

  describe("--format yaml", () => {
    it("outputs valid YAML with fields and types", async () => {
      const { result, output } = await run({ format: "yaml" });

      expect(result).toBeOk();
      const parsed = YAML.parse(output);
      expect(Object.keys(parsed.fields).length).toBeGreaterThan(0);
      expect(Object.keys(parsed.types).length).toBeGreaterThan(0);
    });
  });

  describe("no format", () => {
    it("renders human-readable preview", async () => {
      const { result, output } = await run({});

      expect(result).toBeOk();
      expect(output).toContain("FIELDS:");
      expect(output).toContain("TYPES:");
      expect(() => JSON.parse(output)).toThrow();
    });
  });
});
