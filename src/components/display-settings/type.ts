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
