import { LineLength, Settings, Theme, ThemeProps } from "./type";

export type {
  Settings,
  Setting,
  DisplaySettings,
  Theme,
  ThemeProps,
  LineLength,
} from "./type";

export type FontSize = "x-small" | "small" | "medium" | "large" | "x-large";

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

const lineLengthWidth = new Map<LineLength, number>([
  ["x-small", 400],
  ["small", 500],
  ["medium", 600],
  ["large", 800],
  ["x-large", 1200],
]);

export const lineLengthStyle = (size: LineLength): { "max-width": number } => ({
  "max-width": lineLengthWidth.get(size)!,
});

const fontSizePixels = new Map<LineLength, number>([
  ["x-small", 14],
  ["small", 16],
  ["medium", 18],
  ["large", 22],
  ["x-large", 26],
]);

export const fontSizeStyle = (size: LineLength): { fontSize: number } => ({
  fontSize: fontSizePixels.get(size)!,
});

export const defaultSettings: Settings = {
  fontSize: "medium",
  lineLength: "small",
  theme: "light",
};
