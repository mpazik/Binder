import { customDoclandSchema } from "../libs/jsonld-custom";

import type { ReplaceAction } from "./replace-actions";
import { createReplaceAction } from "./replace-actions";

export type FontFace = "serif" | "sans-serif";
export type FontSize = "x-small" | "small" | "medium" | "large" | "x-large";
export type LineLength = "x-small" | "small" | "medium" | "large" | "x-large";
export type LineHeight = "small" | "medium" | "large";
export type Theme =
  | "light"
  | "dark"
  | "dark-dimmed"
  | "auto-dark"
  | "auto-dark-dimmed";
export type DisplaySettings = {
  fontFace: FontFace;
  fontSize: FontSize;
  lineLength: LineLength;
  lineHeight: LineHeight;
  theme: Theme;
};
export type ThemeProps = {
  "data-color-mode": "light" | "dark" | "auto";
  "data-light-theme"?: string;
  "data-dark-theme"?: string;
};

export type Settings = DisplaySettings;
export type Setting = keyof Settings;

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

export const defaultSettings: Settings = {
  fontFace: "sans-serif",
  fontSize: "medium",
  lineLength: "medium",
  lineHeight: "medium",
  theme: "light",
};
