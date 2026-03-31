import type { Argv } from "yargs";
import { createError, err, isErr, ok } from "@binder/utils";
import { runtimeWithDb, type CommandHandlerWithDb } from "../runtime.ts";
import { redoTransactions } from "../lib/orchestrator.ts";
import { resolveTransactionDisplayKeys } from "../cli/ui.ts";
import { types } from "../cli/types.ts";

export const redoHandler: CommandHandlerWithDb<{
  steps: number;
}> = async (ctx) => {
  const { kg, ui, log, args } = ctx;
  if (args.steps < 1)
    return err(
      createError(
        "invalid-steps",
        `Steps must be at least 1, got ${args.steps}`,
      ),
    );

  const redoResult = await redoTransactions(ctx, args.steps);
  if (isErr(redoResult)) return redoResult;

  const originalTransactions = redoResult.data;

  ui.heading(`Redoing ${args.steps} transaction(s)`);

  const resolved = await resolveTransactionDisplayKeys(
    kg,
    originalTransactions,
  );
  for (const tx of resolved) {
    ui.printRawTransaction(tx);
    ui.println("");
  }

  log.info("Redone successfully", { steps: args.steps });
  ui.block(() => {
    ui.success("Redone successfully");
  });
  return ok(undefined);
};

export const RedoCommand = types({
  command: "redo [steps]",
  describe: "redo the last N undone transactions",
  builder: (yargs: Argv) => {
    return yargs.positional("steps", {
      describe: "number of transactions to redo",
      type: "number",
      default: 1,
    });
  },
  handler: runtimeWithDb(redoHandler),
});
