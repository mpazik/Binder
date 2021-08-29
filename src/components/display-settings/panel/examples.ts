import { DisplaySettingListeners, setupDisplaySettingsPanel } from "./index";

const createLogger = (what: string) => (newValue: string) => {
  console.log(`Changed ${what} to "${newValue}"`);
};

const newVar: DisplaySettingListeners = {
  onFontSizeChange: createLogger("font face"),
  onFontFaceChange: createLogger("font size"),
  onLineLengthChange: createLogger("line length"),
  onLineHeightChange: createLogger("line height"),
  onThemeChange: createLogger("theme"),
};

export const displaySettingsPanelDark = setupDisplaySettingsPanel(newVar)({
  fontFace: "sans-serif",
  fontSize: "x-large",
  lineLength: "small",
  lineHeight: "large",
  theme: "dark",
});

export const displaySettingsPanelLight = setupDisplaySettingsPanel(newVar)({
  fontFace: "serif",
  fontSize: "x-small",
  lineLength: "medium",
  lineHeight: "large",
  theme: "light",
});
