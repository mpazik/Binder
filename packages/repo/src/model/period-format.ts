import { dataTypeDefsToOptions } from "./data-type.ts";
import { createPatternValidator, type TextFormatDefs } from "./text-format.ts";

export const PERIOD_FORMAT_PATTERNS = {
  day: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  week: /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/,
  month: /^\d{4}-(0[1-9]|1[0-2])$/,
  quarter: /^\d{4}-Q[1-4]$/,
  year: /^\d{4}$/,
};

export const periodFormats = {
  day: {
    name: "Day",
    description: "YYYY-MM-DD (e.g. 2024-03-25)",
    validate: createPatternValidator(
      PERIOD_FORMAT_PATTERNS.day,
      "Invalid day format",
    ),
  },
  week: {
    name: "Week",
    description: "YYYY-W## (e.g. 2024-W12)",
    validate: createPatternValidator(
      PERIOD_FORMAT_PATTERNS.week,
      "Invalid week format",
    ),
  },
  month: {
    name: "Month",
    description: "YYYY-MM (e.g. 2024-03)",
    validate: createPatternValidator(
      PERIOD_FORMAT_PATTERNS.month,
      "Invalid month format",
    ),
  },
  quarter: {
    name: "Quarter",
    description: "YYYY-Q# (e.g. 2024-Q1)",
    validate: createPatternValidator(
      PERIOD_FORMAT_PATTERNS.quarter,
      "Invalid quarter format",
    ),
  },
  year: {
    name: "Year",
    description: "YYYY (e.g. 2024)",
    validate: createPatternValidator(
      PERIOD_FORMAT_PATTERNS.year,
      "Invalid year format",
    ),
  },
} as const satisfies TextFormatDefs;

export type PeriodFormat = keyof typeof periodFormats;

export const periodFormatOptions = dataTypeDefsToOptions(periodFormats);
