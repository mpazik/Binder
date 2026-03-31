import type { Argv, CommandModule } from "yargs";
import { groupOptions, parsePositionalNames } from "./help.ts";

export function types<T, U>(input: CommandModule<T, U>) {
  const originalBuilder = input.builder;

  if (typeof originalBuilder === "function") {
    const positionals = parsePositionalNames(
      typeof input.command === "string" ? input.command : "",
    );

    input.builder = (yargs: Argv<T>) =>
      groupOptions(originalBuilder(yargs) as Argv<U>, positionals);
  }

  return input;
}
