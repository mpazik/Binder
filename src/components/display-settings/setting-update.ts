import { customDoclandSchema } from "../../libs/jsonld-custom";

import type { ReplaceAction } from "./replace-action";
import { createReplaceAction } from "./replace-action";
import type { Settings } from "./type";

const customSchemaForSettingValue = <T extends keyof Settings>(
  setting: T,
  value: Settings[T]
) => customDoclandSchema(`${setting}_${value}`);

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
    customDoclandSchema(setting),
    customSchemaForSettingValue(setting, value),
    undefined,
    startDate ?? new Date()
  );
