import "./style.css";

import type {
  DisplaySettings,
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

const fontFaceMap = new Map<FontFace, string>([
  [
    "sans-serif",
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
  ],
  ["serif", 'charter, Georgia, Cambria, "Times New Roman", Times, serif'],
]);

const fontSizeMap = new Map<FontSize, number>([
  ["x-small", 14],
  ["small", 16],
  ["medium", 18],
  ["large", 20],
  ["x-large", 24],
]);

const lineLengthMap = new Map<LineLength, number>([
  ["x-small", 400],
  ["small", 500],
  ["medium", 600],
  ["large", 800],
  ["x-large", 1200],
]);

const imgMaxWidthMap = new Map<LineLength, number>([
  ["x-small", 600],
  ["small", 700],
  ["medium", 800],
  ["large", 1000],
  ["x-large", 1200],
]);

const lineHeightMap = new Map<LineHeight, string>([
  ["small", "1.3"],
  ["medium", "1.5"],
  ["large", "1.8"],
]);

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

export const defaultSettings: Settings = {
  fontFace: "sans-serif",
  fontSize: "medium",
  lineLength: "medium",
  lineHeight: "medium",
  theme: "light",
};

export const updateDisplaySettings = ({
  fontFace,
  fontSize,
  lineLength,
  lineHeight,
  theme,
}: DisplaySettings): void => {
  const style = document.documentElement.style;
  style.setProperty("--font-face", fontFaceMap.get(fontFace)!);
  style.setProperty("--font-size", `${fontSizeMap.get(fontSize)!}px`);
  style.setProperty("--line-width", `${lineLengthMap.get(lineLength)!}px`);
  style.setProperty("--img-max-width", `${imgMaxWidthMap.get(lineLength)!}px`);
  style.setProperty("--line-height", lineHeightMap.get(lineHeight)!);

  const themeProps = themeNodeProps.get(theme)!;
  const body = document.body;
  for (const attr of Object.keys(themeProps)) {
    const propValue = themeProps[attr as keyof ThemeProps];
    if (propValue) {
      body.setAttribute(attr, propValue);
    } else {
      body.removeAttribute(attr);
    }
  }
};
