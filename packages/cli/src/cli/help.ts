import type { Argv } from "yargs";

const GLOBAL_OPTION_KEYS = new Set([
  "help",
  "version",
  "cwd",
  "quiet",
  "print-logs",
  "log-level",
]);

const POSITIONAL_PATTERN = /[<[]([\w]+)(?:\.{2,})?[\]>]/g;

export const parsePositionalNames = (command: string): Set<string> =>
  new Set([...command.matchAll(POSITIONAL_PATTERN)].map((m) => m[1]));

export const groupOptions = <T>(
  yargs: Argv<T>,
  positionalNames?: Set<string>,
): Argv<T> => {
  const opts = (
    yargs as unknown as {
      getOptions(): {
        alias: Record<string, string[]>;
        key: Record<string, boolean>;
      };
    }
  ).getOptions();
  const aliasValues = new Set(Object.values(opts.alias).flat());
  const skip = new Set([
    ...GLOBAL_OPTION_KEYS,
    ...aliasValues,
    ...(positionalNames ?? []),
  ]);

  const commandKeys = Object.keys(opts.key).filter((k) => !skip.has(k));

  if (commandKeys.length > 0) {
    yargs.group(commandKeys, "Command Options:");
  }

  return yargs.group([...GLOBAL_OPTION_KEYS], "Global Options:");
};

const NOISE_PATTERN =
  /\s+\[(?:boolean|string|number|array|default: (?:false|\[\]))\]/g;

export const formatHelpOutput = (text: string): string =>
  text.replace(NOISE_PATTERN, "");

const HELP_SECTION_NAMES = [
  "Options",
  "Global Options",
  "Command Options",
  "Positionals",
  "Commands",
];

const isHelpOutput = (text: string): boolean =>
  HELP_SECTION_NAMES.some((name) => text.includes(`\n${name}:\n`));

export const runWithFormattedHelp = async <T>(
  run: () => Promise<T>,
): Promise<T> => {
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    if (
      args.length === 1 &&
      typeof args[0] === "string" &&
      isHelpOutput(args[0])
    ) {
      originalLog(formatHelpOutput(args[0]));
      return;
    }
    originalLog(...args);
  };

  // eslint-disable-next-line no-restricted-syntax -- try/finally for cleanup, not error handling
  try {
    return await run();
  } finally {
    console.log = originalLog;
  }
};
