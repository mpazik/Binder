export type FontSize = "x-small" | "small" | "medium" | "large" | "x-large";
export type LineLength = "x-small" | "small" | "medium" | "large" | "x-large";
export type Theme = "light" | "dark" | "dark-dimmed" | "auto";

export type DisplaySettings = {
  fontSize: FontSize;
  lineLength: LineLength;
  theme: Theme;
};

type ThemeProps = {
  "data-color-mode": "light" | "dark" | "auto";
  "data-light-theme"?: string;
  "data-dark-theme"?: string;
};
const themeNodeProps = new Map<Theme, ThemeProps>([
  ["light", { "data-color-mode": "light", "data-light-theme": "light" }],
  [
    "dark-dimmed",
    { "data-color-mode": "dark", "data-dark-theme": "dark_dimmed" },
  ],
  ["dark", { "data-color-mode": "dark", "data-dark-theme": "dark" }],
  [
    "auto",
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
