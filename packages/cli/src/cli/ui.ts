import { EOL } from "os";
import * as readline from "node:readline/promises";
import * as YAML from "yaml";
import {
  type EntitiesChangeset,
  type FieldChangeset,
  type FieldValue,
  isClearChange,
  isSeqChange,
  isSetChange,
  type KnowledgeGraph,
  normalizeValueChange,
  type RecordsChangeset,
  type RecordUid,
  shortTransactionHash,
  type Transaction,
  type ValueChange,
} from "@binder/db";
import { type ErrorObject, isErr, noop } from "@binder/utils";
import {
  serialize,
  type SerializeFormat,
  type SerializeItemFormat,
} from "../utils/serialize.ts";

export const Style = {
  TEXT_HIGHLIGHT: "\x1b[95m",
  TEXT_HIGHLIGHT_BOLD: "\x1b[95m\x1b[1m",
  TEXT_DIM: "\x1b[90m",
  TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
  TEXT_NORMAL: "\x1b[0m",
  TEXT_NORMAL_BOLD: "\x1b[1m",
  TEXT_WARNING: "\x1b[93m",
  TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
  TEXT_DANGER: "\x1b[91m",
  TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
  TEXT_SUCCESS: "\x1b[92m",
  TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
  TEXT_INFO: "\x1b[94m",
  TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
};

export const logo = () => {
  // prettier-ignore
  const binderLogo = [
    " ▂▄▅▆▆▄▂",
    "▜▛▆▇▁▁▆▜▙    ▄▄▄▄  ▄▖          ▗▄",
    "  ▅▂▀▀▃▆▅▖   █▌ ▐▋ ▄▖ ▄▖▗▄▖  ▄▄▟█ ▗▄▄▄▖ ▄▖▄▄",
    " ▌█▁ ▂▟▂▝█▏  █▛▀▜▙ █▌ █▛▘▐█ █▌ ▐█ █▙▄▟█ ▐█",
    "  ▅▃▂▄▆ ▟▋   █▙▄▟▛ █▌ █▌ ▐█ ▜▙▄▟▛ ▜▙▄▄▆ ▐█",
    "   ▃▆▄▅▂▄",
  ];

  // prettier-ignore
  const inverseMask = [
    "",
    "  xx  x",
    "   x  x",
    " x     x",
    "  xxxxx",
    "   x   xx",
  ];

  const REVERSE = "\x1b[7m";
  const REVERSE_OFF = "\x1b[27m";
  const lines = binderLogo.map((line, r) => {
    const mask = inverseMask[r] || "";
    const chars = [...line];
    const maskChars = [...mask];
    let result = "";
    let inInverse = false;
    for (let c = 0; c < chars.length; c++) {
      const isInverse = maskChars[c] === "x";
      if (isInverse && !inInverse) {
        result += REVERSE;
        inInverse = true;
      } else if (!isInverse && inInverse) {
        result += REVERSE_OFF;
        inInverse = false;
      }
      result += chars[c];
    }
    if (inInverse) result += REVERSE_OFF;
    return result;
  });

  return Style.TEXT_DIM + lines.join(EOL) + Style.TEXT_NORMAL;
};

const print = (...message: string[]) => {
  process.stdout.write(message.join(" "));
};

const println = (...message: string[]) => {
  print(...message);
  process.stdout.write(EOL);
};

const eprint = (...message: string[]) => {
  process.stderr.write(message.join(" "));
};

const eprintln = (...message: string[]) => {
  eprint(...message);
  process.stderr.write(EOL);
};

const input = async (prompt: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(prompt);
  rl.close();
  return answer;
};

const success = (message: string) => {
  eprintln(Style.TEXT_SUCCESS + message + Style.TEXT_NORMAL);
};

const warning = (message: string) => {
  eprintln(Style.TEXT_WARNING + "WARNING: " + Style.TEXT_NORMAL + message);
};

const info = (message: string) => {
  eprintln(Style.TEXT_INFO + message + Style.TEXT_NORMAL);
};

const danger = (message: string) => {
  eprintln(Style.TEXT_DANGER + message + Style.TEXT_NORMAL);
};

const divider = (width = 60) => {
  eprintln(Style.TEXT_DIM + "─".repeat(width) + Style.TEXT_NORMAL);
};

const heading = (message: string) => {
  eprintln("");
  eprintln(Style.TEXT_INFO_BOLD + message + Style.TEXT_NORMAL);
};

const block = (fn: () => void) => {
  eprintln("");
  fn();
  eprintln("");
};

const keyValue = (key: string, value: string) => {
  eprintln(`  ${Style.TEXT_DIM}${key}:${Style.TEXT_NORMAL} ${value}`);
};

const keyValuesInline = (...pairs: [string, string][]) => {
  const formatted = pairs
    .map(
      ([key, value]) => `${Style.TEXT_DIM}${key}:${Style.TEXT_NORMAL} ${value}`,
    )
    .join("  ");
  eprintln(`  ${formatted}`);
};

const formatValue = (value: unknown, indent: string): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return (
      "\n" +
      value
        .map((item, i) => {
          const itemStr = formatValue(item, indent + "  ");
          return `${indent}  [${i}] ${itemStr}`;
        })
        .join("\n")
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return (
      "\n" +
      entries
        .map(([k, v]) => {
          const valStr = formatValue(v, indent + "  ");
          return `${indent}  ${Style.TEXT_INFO}${k}${Style.TEXT_NORMAL}: ${valStr}`;
        })
        .join("\n")
    );
  }
  return String(value);
};

const error = (message: string) => {
  eprintln(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message);
};

type ValidationError = { field?: string; fieldKey?: string; message?: string };

const printError = (errorObj: ErrorObject) => {
  eprintln(
    Style.TEXT_DANGER_BOLD +
      "Error: " +
      Style.TEXT_NORMAL +
      (errorObj.message || errorObj.key),
  );

  if (
    errorObj.key === "changeset-input-process-failed" &&
    errorObj.data &&
    "errors" in errorObj.data
  ) {
    const errors = errorObj.data.errors as ValidationError[] | undefined;
    if (Array.isArray(errors) && errors.length > 0) {
      eprintln(Style.TEXT_DANGER + "Validation errors:" + Style.TEXT_NORMAL);
      for (const validationError of errors) {
        const fieldName = validationError.field ?? validationError.fieldKey;
        const message = fieldName
          ? `Field '${Style.TEXT_INFO}${fieldName}${Style.TEXT_NORMAL}': ${validationError.message ?? formatValue(validationError, "    ")}`
          : (validationError.message ?? formatValue(validationError, "    "));
        eprintln(`  - ${message}`);
      }
      return;
    }
  }

  eprintln(Style.TEXT_DIM + "Error details:" + Style.TEXT_NORMAL);
  eprintln(formatValue(errorObj.data, ""));
};

const stripNulls = (_: string, v: unknown) => (v === null ? undefined : v);

const printData = (data: unknown, format?: SerializeFormat) => {
  if (format) {
    println(serialize(data, format));
    return;
  }

  const yamlOutput = YAML.stringify(data, stripNulls, {
    indent: 2,
    lineWidth: 0,
    defaultStringType: "PLAIN",
  });

  const highlighted = yamlOutput
    .split(EOL)
    .map((line) => {
      const keyMatch = line.match(/^(\s*)([^:\s][^:]*?)(:)(.*)$/);
      if (keyMatch) {
        const [, indent, key, colon, value] = keyMatch;
        return (
          indent + Style.TEXT_INFO + key + Style.TEXT_NORMAL + colon + value
        );
      }
      return line;
    })
    .join(EOL);

  println(highlighted);
};

export type TransactionFormat =
  | "oneline"
  | "concise"
  | "full"
  | SerializeItemFormat;

const formatFieldValue = (value: FieldValue | undefined): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") {
    if (value.length > 50) return `"${value.slice(0, 47)}..."`;
    return `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") return `{${Object.keys(value).length} fields}`;
  return String(value);
};

const printFieldChange = (
  fieldKey: string,
  change: ValueChange,
  indent: string,
) => {
  if (isSetChange(change)) {
    const value = change[1];
    const previous = change.length === 3 ? change[2] : undefined;
    if (previous === undefined && value !== undefined) {
      eprintln(
        `${indent}${Style.TEXT_DIM}${fieldKey}:${Style.TEXT_NORMAL} ${formatFieldValue(value)}`,
      );
    } else {
      eprintln(
        `${indent}${Style.TEXT_DIM}${fieldKey}:${Style.TEXT_NORMAL} ` +
          `${formatFieldValue(previous)} → ${formatFieldValue(value)}`,
      );
    }
  } else if (isClearChange(change)) {
    eprintln(
      `${indent}${Style.TEXT_DIM}${fieldKey}: ` +
        `${Style.TEXT_DANGER}${formatFieldValue(change[1])} → (deleted)${Style.TEXT_NORMAL}`,
    );
  } else if (isSeqChange(change)) {
    eprintln(
      `${indent}${Style.TEXT_DIM}${fieldKey}:${Style.TEXT_NORMAL} list mutations:`,
    );
    for (const mutation of change[1]) {
      const [kind, mutValue, position] = mutation;
      const posText =
        position !== undefined ? ` at position ${position}` : " at end";
      const kindStyle =
        kind === "insert" ? Style.TEXT_SUCCESS : Style.TEXT_DANGER;
      eprintln(
        `${indent}  ${kindStyle}[${kind}]${Style.TEXT_NORMAL} ${formatFieldValue(mutValue)}${Style.TEXT_DIM}${posText}${Style.TEXT_NORMAL}`,
      );
    }
  }
};

const getEntityOperation = (changeset: FieldChangeset): string => {
  if ("type" in changeset) {
    const change = normalizeValueChange(changeset.type);
    if (isSetChange(change)) {
      if (change.length === 2) return "created";
    }
    if (isClearChange(change)) return "deleted";
  }
  return "updated";
};

const getEntityLabel = (changeset: FieldChangeset): string => {
  const change = normalizeValueChange(
    changeset.type ?? changeset.name ?? changeset.label,
  );
  if (!isSetChange(change) && !isClearChange(change))
    return `DUBIOUS CHANGE OPERATOR: '${change[0]}'`;
  const label = change[1];
  return label ? ` (${label})` : "";
};

const printEntityChanges = (
  label: string,
  changes: EntitiesChangeset,
  format: "concise" | "full" = "concise",
) => {
  const entries = Object.entries(changes) as [string, FieldChangeset][];
  if (entries.length === 0) return;

  if (format === "full") eprintln("");
  eprintln(`  ${Style.TEXT_DIM}${label} (${entries.length})`);

  for (const [uid, changeset] of entries) {
    const operation = getEntityOperation(changeset);
    const entityLabel = getEntityLabel(changeset);

    if (format === "concise") {
      eprintln(`    - ${uid}${entityLabel} ${operation}`);
    } else {
      eprintln(
        `    ${Style.TEXT_INFO}${uid}${entityLabel}${Style.TEXT_NORMAL} ${operation}`,
      );

      const fields = Object.entries(changeset).filter(
        ([key]) => key !== "createdAt" && key !== "updatedAt",
      ) as [string, FieldValue | ValueChange][];
      for (const [fieldKey, change] of fields) {
        printFieldChange(fieldKey, normalizeValueChange(change), "      ");
      }
    }
  }
};

const printTransaction = (
  transaction: Transaction,
  format: TransactionFormat = "concise",
) => {
  if (format === "json" || format === "yaml") {
    printData(transaction, format);
    return;
  }
  const hash =
    format === "full" ? transaction.hash : shortTransactionHash(transaction);
  const timestamp = new Date(transaction.createdAt).toISOString();

  if (format === "oneline") {
    const recordCount = Object.keys(transaction.records).length;
    const configCount = Object.keys(transaction.configs).length;
    const recordText = recordCount === 1 ? "record" : "records";
    const configText = configCount === 1 ? "config" : "configs";

    eprintln(
      `${Style.TEXT_INFO_BOLD}#${transaction.id} ` +
        `${Style.TEXT_DIM}${hash} (${transaction.author})` +
        `${Style.TEXT_NORMAL} ${timestamp} - ${recordCount} ${recordText}, ${configCount} ${configText}`,
    );
    return;
  }

  eprintln(
    Style.TEXT_INFO_BOLD + `Transaction #${transaction.id}` + Style.TEXT_NORMAL,
  );
  keyValuesInline(
    ["Hash", hash],
    ["Author", transaction.author],
    ["Created", timestamp],
  );

  printEntityChanges("Record changes", transaction.records, format);
  printEntityChanges("Config changes", transaction.configs, format);
};

/**
 * Rewrites transaction record keys from UIDs to human-readable keys for display.
 * Extracts keys from changesets first (covers creates), then falls back to a DB
 * lookup for records that didn't have their key in the changeset. Silently keeps
 * the raw UID for deleted or otherwise unresolvable records.
 */
const buildUidToKeyMap = async (
  kg: KnowledgeGraph,
  transactions: Transaction[],
): Promise<Map<string, string>> => {
  const uidToKey = new Map<string, string>();

  for (const tx of transactions) {
    for (const [uid, changeset] of Object.entries(tx.records)) {
      if (uidToKey.has(uid)) continue;
      const keyChange = changeset.key;
      if (keyChange !== undefined) {
        const normalized = normalizeValueChange(keyChange);
        if (isSetChange(normalized) && typeof normalized[1] === "string") {
          uidToKey.set(uid, normalized[1]);
        }
      }
    }
  }

  const missing = [
    ...new Set(transactions.flatMap((tx) => Object.keys(tx.records))),
  ].filter((uid) => !uidToKey.has(uid));

  for (const uid of missing) {
    const result = await kg.fetchEntity(uid as RecordUid);
    if (isErr(result)) continue;
    const key = result.data.key;
    if (typeof key === "string") uidToKey.set(uid, key);
  }

  return uidToKey;
};

const remapRecordKeys = (
  tx: Transaction,
  uidToKey: Map<string, string>,
): Transaction => ({
  ...tx,
  records: Object.fromEntries(
    Object.entries(tx.records).map(([uid, changeset]) => [
      uidToKey.get(uid) ?? uid,
      changeset,
    ]),
  ) as RecordsChangeset,
});

export const resolveTransactionDisplayKey = async (
  kg: KnowledgeGraph,
  transaction: Transaction,
): Promise<Transaction> => {
  const uidToKey = await buildUidToKeyMap(kg, [transaction]);
  return remapRecordKeys(transaction, uidToKey);
};

export const resolveTransactionDisplayKeys = async (
  kg: KnowledgeGraph,
  transactions: Transaction[],
): Promise<Transaction[]> => {
  const uidToKey = await buildUidToKeyMap(kg, transactions);
  return transactions.map((tx) => remapRecordKeys(tx, uidToKey));
};

export type Ui = {
  println(...message: string[]): void;
  print(...message: string[]): void;
  input(prompt: string): Promise<string>;
  success(message: string): void;
  warning(message: string): void;
  info(message: string): void;
  danger(message: string): void;
  divider(width?: number): void;
  heading(message: string): void;
  block(fn: () => void): void;
  keyValue(key: string, value: string): void;
  keyValuesInline(...pairs: [string, string][]): void;
  list(items: string[], indent?: number): void;
  confirm(prompt: string): Promise<boolean>;
  printRawTransaction(
    transaction: Transaction,
    format?: TransactionFormat,
  ): void;
  printRawTransactions(
    transactions: Transaction[],
    format?: TransactionFormat,
  ): void;
  printTransaction(
    kg: KnowledgeGraph,
    transaction: Transaction,
    format?: TransactionFormat,
  ): Promise<void>;
  printTransactions(
    kg: KnowledgeGraph,
    transactions: Transaction[],
    format?: TransactionFormat,
  ): Promise<void>;
  error(message: string): void;
  printError(error: ErrorObject): void;
  printData(data: unknown, format?: SerializeFormat): void;
};

export const createUi = (options: { quiet?: boolean } = {}): Ui => {
  const { quiet = false } = options;

  if (quiet) {
    return {
      println: noop,
      print: noop,
      input,
      success: noop,
      warning: noop,
      info: noop,
      danger: noop,
      divider: noop,
      heading: noop,
      block: noop,
      keyValue: noop,
      keyValuesInline: noop,
      list: noop,
      confirm: async () => false,
      printRawTransaction: (transaction, format) => {
        if (format === "json" || format === "yaml")
          printData(transaction, format);
      },
      printRawTransactions: noop,
      printTransaction: async (kg, transaction, format) => {
        if (format === "json" || format === "yaml") {
          const resolved = await resolveTransactionDisplayKey(kg, transaction);
          printData(resolved, format);
        }
      },
      printTransactions: async (kg, transactions, format) => {
        if (format === "json" || format === "yaml") {
          const resolved = await resolveTransactionDisplayKeys(
            kg,
            transactions,
          );
          for (const tx of resolved) printData(tx, format);
        }
      },
      error,
      printError,
      printData,
    };
  }

  return {
    println,
    print,
    input,
    success,
    warning,
    info,
    danger,
    divider,
    heading,
    block,
    keyValue,
    keyValuesInline,
    list: (items: string[], indent: number = 2) => {
      const prefix = " ".repeat(indent);
      for (const item of items) {
        eprintln(`${prefix}- ${item}`);
      }
    },
    confirm: async (prompt: string): Promise<boolean> => {
      const answer = (await input(prompt)).toLowerCase();
      return answer === "yes" || answer === "y";
    },
    printRawTransaction: printTransaction,
    printRawTransactions: (
      transactions: Transaction[],
      format: TransactionFormat = "concise",
    ) => {
      for (const tx of transactions) {
        printTransaction(tx, format);
        if (format === "full") eprintln("");
      }
    },
    printTransaction: async (kg, transaction, format) => {
      const resolved = await resolveTransactionDisplayKey(kg, transaction);
      printTransaction(resolved, format);
    },
    printTransactions: async (kg, transactions, format = "concise") => {
      const resolved = await resolveTransactionDisplayKeys(kg, transactions);
      for (const tx of resolved) {
        printTransaction(tx, format);
        if (format === "full") eprintln("");
      }
    },
    error,
    printError,
    printData,
  };
};
