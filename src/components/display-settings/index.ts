import "./style.css";

import {
  FontFace,
  FontSize,
  LineHeight,
  LineLength,
  Settings,
  Theme,
  ThemeProps,
} from "./type";

export type {
  Settings,
  Setting,
  DisplaySettings,
  Theme,
  ThemeProps,
  LineLength,
} from "./type";

const fontFace = new Map<FontFace, string>([
  [
    "sans-serif",
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
  ],
  ["serif", "Georgia, serif"],
]);

export const fontFaceStyle = (size: FontFace): { fontFamily: string } => ({
  fontFamily: fontFace.get(size)!,
});

const fontSizePixels = new Map<FontSize, number>([
  ["x-small", 14],
  ["small", 16],
  ["medium", 18],
  ["large", 20],
  ["x-large", 24],
]);

export const fontSizeStyle = (size: FontSize): { fontSize: number } => ({
  fontSize: fontSizePixels.get(size)!,
});

const lineLength = new Map<LineLength, number>([
  ["x-small", 400],
  ["small", 500],
  ["medium", 600],
  ["large", 800],
  ["x-large", 1200],
]);

export const lineLengthStyle = (size: LineLength): { "max-width": number } => ({
  "max-width": lineLength.get(size)!,
});

const lineHeight = new Map<LineHeight, string>([
  ["small", "1.3"],
  ["medium", "1.5"],
  ["large", "1.8"],
]);

export const lineHeightStyle = (size: LineHeight): { lineHeight: string } => ({
  lineHeight: lineHeight.get(size)!,
});

const themeNodeProps = new Map<Theme, ThemeProps>([
  ["light", { "data-color-mode": "light", "data-light-theme": "light" }],
  [
    "dark-dimmed",
    { "data-color-mode": "dark", "data-dark-theme": "dark_dimmed" },
  ],
  ["dark", { "data-color-mode": "dark", "data-dark-theme": "dark" }],
  [
    "auto-dark",
    {
      "data-color-mode": "auto",
      "data-light-theme": "light",
      "data-dark-theme": "dark",
    },
  ],
  [
    "auto-dark-dimmed",
    {
      "data-color-mode": "auto",
      "data-light-theme": "light",
      "data-dark-theme": "dark_dimmed",
    },
  ],
]);

export const themeProps = (theme: Theme): ThemeProps =>
  themeNodeProps.get(theme)!;

export const defaultSettings: Settings = {
  fontFace: "sans-serif",
  fontSize: "medium",
  lineLength: "small",
  lineHeight: "medium",
  theme: "light",
};
