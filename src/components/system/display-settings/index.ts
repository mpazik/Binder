import type {
  DisplaySettings,
  FontFace,
  FontSize,
  LineHeight,
  LineLength,
  Theme,
  ThemeProps,
} from "../../../vocabulary/setting-update";

const fontFaceMap = new Map<FontFace, string>([
  [
    "sans-serif",
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
  ],
  ["serif", 'charter, Georgia, Cambria, "Times New Roman", Times, serif'],
]);

const fontSizeMap = new Map<FontSize, number>([
  ["x-small", 16],
  ["small", 18],
  ["medium", 20],
  ["large", 24],
  ["x-large", 28],
]);

const lineLengthMap = new Map<LineLength, number>([
  ["x-small", 300],
  ["small", 450],
  ["medium", 600],
  ["large", 800],
  ["x-large", 1200],
]);

const imgMaxWidthMap = new Map<LineLength, number>([
  ["x-small", 500],
  ["small", 600],
  ["medium", 700],
  ["large", 850],
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
