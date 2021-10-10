import type {
  ReplaceAction as ReplaceActionSchema,
  WithContext,
} from "schema-dts";

import type { Settings } from "./type";

export type ReplaceAction = WithContext<ReplaceActionSchema>;

export const createReplaceAction = (
  target: string,
  replacer: string,
  replacee?: string,
  startTime?: Date,
  agent?: string
): WithContext<ReplaceAction> => ({
  "@context": "https://schema.org",
  "@type": "ReplaceAction",
  ...(startTime ? { startTime: startTime.toISOString() } : {}),
  ...(agent ? { agent } : {}),
  target,
  replacer,
  ...(replacee ? { replacee } : {}),
});

const customSchema = (name: string) => "https://schema.docland.app/" + name;
export const nameFromCustomSchema = (name: string): string =>
  name.replace(/^https:\/\/schema.docland.app\//, "");

const customSchemaForSettingValue = <T extends keyof Settings>(
  setting: T,
  value: Settings[T]
) => customSchema(`${setting}_${value}`);

export const settingValueFromCustomSchema = <T extends keyof Settings>(
  value: string,
  setting: T
): Settings[T] =>
  value
    .replace(/^https:\/\/schema.docland.app\//, "")
    .replace(setting + "_", "") as Settings[T];

export const createSettingUpdateAction = <T extends keyof Settings>(
  setting: T,
  value: Settings[T],
  startDate?: Date
): ReplaceAction =>
  createReplaceAction(
    customSchema(setting),
    customSchemaForSettingValue(setting, value),
    undefined,
    startDate ?? new Date()
  );
